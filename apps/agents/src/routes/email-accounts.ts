import { z } from 'zod'
import type { Env } from '../types'

// HTTP routes for the Gmail OAuth flow living on the web app.
// The web callback POSTs the encrypted refresh_token here; the settings page
// GETs /me to render connection state. Auth is the Clerk JWT verified upstream
// in the Worker entry — userId arrives via the X-User-Id header.

const UpsertBodySchema = z.object({
  email: z.string().email(),
  encryptedRefreshToken: z.string().min(1),
  // Required: anchors forward-only ingestion. Reconnect intentionally
  // re-anchors to "now," so the ON CONFLICT branch overwrites this too.
  lastHistoryId: z.string().min(1),
})

export async function handleEmailAccountUpsert(
  req: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  let body: z.infer<typeof UpsertBodySchema>
  try {
    body = UpsertBodySchema.parse(await req.json())
  } catch {
    return new Response('invalid body', { status: 400 })
  }

  // Reject if this Gmail address is already linked to a different user.
  // The schema's UNIQUE(email) constraint would do this implicitly, but a
  // pre-check lets us return a proper 409 instead of a generic insert error.
  const existing = await env.DB.prepare(
    `SELECT user_id FROM email_accounts WHERE email = ? LIMIT 1`,
  )
    .bind(body.email)
    .first<{ user_id: string }>()

  if (existing && existing.user_id !== userId) {
    log('email_accounts upsert conflict — email owned by another user', {
      userId,
    })
    return new Response('email already linked to another account', {
      status: 409,
    })
  }

  // Beta model: one Gmail per user. If the user reconnects with a different
  // address, drop the old row before inserting the new one.
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM email_accounts WHERE user_id = ? AND email != ?`,
    ).bind(userId, body.email),
    env.DB.prepare(
      `INSERT INTO email_accounts (id, user_id, email, encrypted_refresh_token, last_history_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET
         encrypted_refresh_token = excluded.encrypted_refresh_token,
         last_history_id = excluded.last_history_id`,
    ).bind(
      id,
      userId,
      body.email,
      body.encryptedRefreshToken,
      body.lastHistoryId,
      now,
    ),
  ])

  log('email_accounts upserted', { userId })
  return Response.json({ ok: true })
}

export async function handleEmailAccountStatus(
  req: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('method not allowed', { status: 405 })
  }

  const row = await env.DB.prepare(
    `SELECT email FROM email_accounts WHERE user_id = ? LIMIT 1`,
  )
    .bind(userId)
    .first<{ email: string }>()

  if (!row) {
    return Response.json({ connected: false })
  }
  return Response.json({ connected: true, email: row.email })
}

function log(message: string, data?: unknown) {
  console.log(JSON.stringify({ message, data, ts: new Date().toISOString() }))
}
