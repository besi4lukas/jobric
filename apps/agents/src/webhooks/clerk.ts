import { Webhook } from 'svix'
import { z } from 'zod'
import type { Env } from '../types'

// ─── Clerk webhook payload shapes ──────────────────────────────────────────────
// Clerk delivers many event types; we only validate the user.* shapes we care
// about. Everything else is logged and acked.

const ClerkEmailSchema = z.object({
  id: z.string(),
  email_address: z.string().email(),
})

const ClerkUserDataSchema = z.object({
  id: z.string().min(1),
  email_addresses: z.array(ClerkEmailSchema).default([]),
  primary_email_address_id: z.string().nullable().optional(),
})

const ClerkDeletedUserDataSchema = z.object({
  id: z.string().min(1),
  deleted: z.literal(true).optional(),
})

type ClerkUserData = z.infer<typeof ClerkUserDataSchema>

// ─── Handler ───────────────────────────────────────────────────────────────────
export async function handleClerkWebhook(
  req: Request,
  env: Env,
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('missing svix headers', { status: 400 })
  }

  const payload = await req.text()

  let evt: { type: string; data: unknown }
  try {
    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET)
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: unknown }
  } catch (err) {
    log('clerk webhook signature invalid', { error: String(err) })
    return new Response('invalid signature', { status: 401 })
  }

  log('clerk webhook received', { type: evt.type })

  switch (evt.type) {
    case 'user.created':
    case 'user.updated':
      return upsertUser(evt.type, evt.data, env)
    case 'user.deleted':
      return handleUserDeleted(evt.data, env)
    default:
      log('clerk webhook ignored', { type: evt.type })
      return new Response('ignored', { status: 200 })
  }
}

// Shared path for user.created and user.updated — both upsert so user.updated
// is self-healing if the create webhook was missed (e.g. backfill, replay).
async function upsertUser(
  eventType: 'user.created' | 'user.updated',
  data: unknown,
  env: Env,
): Promise<Response> {
  const user = ClerkUserDataSchema.parse(data)
  const email = primaryEmail(user)
  if (!email) {
    log(`clerk webhook ${eventType} skipped — no email`, { id: user.id })
    return new Response('no email', { status: 200 })
  }

  const now = new Date().toISOString()
  const result = await env.DB.prepare(
    `INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET email = excluded.email`,
  )
    .bind(user.id, email, now)
    .run()

  log(`clerk webhook ${eventType} upserted`, {
    id: user.id,
    rowsWritten: result.meta.changes ?? 0,
  })
  return new Response('ok', { status: 200 })
}

async function handleUserDeleted(data: unknown, env: Env): Promise<Response> {
  const user = ClerkDeletedUserDataSchema.parse(data)
  // Hard delete — beta. FKs to users CASCADE in 0001_schema_v1.sql.
  const result = await env.DB.prepare(`DELETE FROM users WHERE id = ?`)
    .bind(user.id)
    .run()

  log('clerk webhook user.deleted', {
    id: user.id,
    rowsWritten: result.meta.changes ?? 0,
  })
  return new Response('ok', { status: 200 })
}

function primaryEmail(user: ClerkUserData): string | null {
  const primary =
    user.email_addresses.find((e) => e.id === user.primary_email_address_id) ??
    user.email_addresses[0]
  return primary?.email_address ?? null
}

function log(message: string, data?: unknown) {
  console.log(JSON.stringify({ message, data, ts: new Date().toISOString() }))
}
