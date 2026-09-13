import { z } from 'zod'
import type { Env } from '../types'
import { ApplicationStatusSchema } from '../db/schema'

// HTTP route for the dashboard AI Inbox tab: GET /api/inbox?limit=&cursor=
//
// Same shape of decision as routes/overview.ts — plain D1 reads, deliberately
// not on OrchestratorAgent (a global singleton serializing LLM calls), and
// never an LLM call on this path: threads.summary is written by the cron
// tick (lib/thread-summary.ts) and only read here.
//
// Pagination is keyset, not OFFSET. The list is newest-first and new mail
// lands at the top between page loads; with OFFSET, page 2 would repeat or
// skip whatever shifted. A cursor on (last_message_at, id) is stable under
// inserts and is served directly by idx_threads_user_last_message
// (migration 0004). The cursor is opaque to the client: base64url JSON of
// the last row's sort key.

export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 50

// `nextCursor` and `summaryState` are required here but defaulted on the web
// side (apps/web/.../dashboard/_lib/inbox-schema.ts) — the same deliberate
// asymmetry as the overview contract, for the same mid-rollout reason. See
// routes/overview.ts.
export const InboxThreadSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  status: ApplicationStatusSchema,
  summary: z.string().nullable(),
  // 'pending' = no summary yet (cron hasn't reached it, or generation keeps
  // failing). A stale-but-present summary is still 'ready' — showing the
  // last good line beats showing nothing while it regenerates.
  summaryState: z.enum(['ready', 'pending']),
  // Newest message's subject — the UI's fallback line while pending.
  lastSubject: z.string().nullable(),
  lastMessageAt: z.string(),
  messageCount: z.number().int().nonnegative(),
})
export type InboxThread = z.infer<typeof InboxThreadSchema>

export const InboxResponseSchema = z.object({
  threads: z.array(InboxThreadSchema),
  nextCursor: z.string().nullable(),
})
export type InboxResponse = z.infer<typeof InboxResponseSchema>

type Cursor = { t: string; id: string }

const CursorSchema = z.object({ t: z.string().min(1), id: z.string().min(1) })

export function encodeCursor(cursor: Cursor): string {
  return base64UrlEncode(JSON.stringify(cursor))
}

// null for anything that isn't a cursor we produced — the caller 400s.
export function decodeCursor(value: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(value))
    const result = CursorSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

type ThreadRow = {
  id: string
  company: string
  role: string
  status: string
  summary: string | null
  last_subject: string | null
  last_message_at: string
  message_count: number
}

export async function handleInbox(
  req: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('method not allowed', { status: 405 })
  }

  const url = new URL(req.url)

  const limit = parseLimit(url.searchParams.get('limit'))
  if (limit === null) {
    return new Response('invalid limit', { status: 400 })
  }

  const rawCursor = url.searchParams.get('cursor')
  const cursor = rawCursor === null ? null : decodeCursor(rawCursor)
  if (rawCursor !== null && cursor === null) {
    return new Response('invalid cursor', { status: 400 })
  }

  // Fetch one extra row to learn whether a next page exists without a
  // second COUNT query. The (a < x OR (a = x AND b < y)) form is the
  // portable spelling of the row-value comparison (a, b) < (x, y).
  //
  // last_message_at IS NOT NULL: nullable only because of the ALTER TABLE
  // in 0004; recordMessage() always sets it, but a NULL would otherwise
  // sort unpredictably and can't be keyset-paged.
  const result = await env.DB.prepare(
    `SELECT t.id, c.name AS company, a.role_title AS role, a.status,
            t.summary, t.last_message_at, t.message_count,
            (SELECT m.subject FROM messages m
              WHERE m.thread_id = t.id
              ORDER BY m.sent_at DESC, m.id DESC
              LIMIT 1) AS last_subject
     FROM threads t
     JOIN applications a ON a.id = t.application_id
     JOIN companies c ON c.id = a.company_id
     WHERE t.user_id = ?
       AND t.last_message_at IS NOT NULL
       AND (? IS NULL
            OR t.last_message_at < ?
            OR (t.last_message_at = ? AND t.id < ?))
     ORDER BY t.last_message_at DESC, t.id DESC
     LIMIT ?`,
  )
    .bind(
      userId,
      cursor?.t ?? null,
      cursor?.t ?? null,
      cursor?.t ?? null,
      cursor?.id ?? null,
      limit + 1,
    )
    .all<ThreadRow>()

  const rows = result.results ?? []
  const page = rows.slice(0, limit)
  const last = page[page.length - 1]
  const nextCursor =
    rows.length > limit && last
      ? encodeCursor({ t: last.last_message_at, id: last.id })
      : null

  const response = InboxResponseSchema.parse({
    threads: page.map((row) => ({
      id: row.id,
      company: row.company,
      role: row.role,
      status: row.status,
      summary: row.summary,
      summaryState: row.summary ? 'ready' : 'pending',
      lastSubject: row.last_subject,
      lastMessageAt: row.last_message_at,
      messageCount: row.message_count,
    })),
    nextCursor,
  })

  return Response.json(response)
}

// null = reject with 400. Absent → default; present must be an integer in
// [1, MAX_LIMIT] — a client asking for 500 rows is a bug, not a preference.
function parseLimit(raw: string | null): number | null {
  if (raw === null) return DEFAULT_LIMIT
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  if (n < 1 || n > MAX_LIMIT) return null
  return n
}

// Workers and Node both have btoa/atob; TextEncoder round-trips non-ASCII
// (thread ids are UUIDs and timestamps are ISO, but don't rely on it).
function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
