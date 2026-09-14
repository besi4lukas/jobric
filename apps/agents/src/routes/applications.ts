import { z } from 'zod'
import type { Env } from '../types'
import { ApplicationStatusSchema, StatusSourceSchema } from '../db/schema'
import {
  APPLICATION_ROW_SELECT,
  mapApplicationRow,
  setApplicationStatusByUser,
  type ApplicationRowDb,
} from '../db/applications'
import { decodeCursor, encodeCursor } from '../lib/keyset-cursor'

// HTTP routes for the dashboard Applications tab:
//   GET   /api/applications?limit=&cursor=
//   PATCH /api/applications/:id/status
//
// Same shape of decision as routes/inbox.ts and routes/overview.ts — plain
// D1 reads (and, for PATCH, a single small write) registered ahead of
// routeAgentRequest, deliberately not on OrchestratorAgent (a global
// singleton serializing multi-second LLM calls — techdebt #5). The DO's own
// /applications endpoint (getApplications()) had no caller and is deleted
// alongside this route landing.
//
// Pagination is keyset on (last_activity_at, id), same reasoning as the
// Inbox route: the list is newest-first and last_activity_at changes on
// every ingested email (or PATCH), so OFFSET would repeat or skip rows that
// moved. See lib/keyset-cursor.ts for the codec, shared with routes/inbox.ts.

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 100

// Required here (Worker side); the web contract (PR B) may default these —
// see the asymmetry note in routes/overview.ts, same reasoning applies.
export const ApplicationRowSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  requisitionId: z.string().nullable(),
  status: ApplicationStatusSchema,
  statusSource: StatusSourceSchema,
  emailCount: z.number().int().min(0),
  lastActivityAt: z.string(),
  interviewAt: z.string().nullable(),
})
export type ApplicationRow = z.infer<typeof ApplicationRowSchema>

export const ApplicationsResponseSchema = z.object({
  applications: z.array(ApplicationRowSchema),
  nextCursor: z.string().nullable(),
})
export type ApplicationsResponse = z.infer<typeof ApplicationsResponseSchema>

const StatusUpdateBodySchema = z.object({ status: ApplicationStatusSchema })

export async function handleApplicationsList(
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
  // second COUNT query — same trick as routes/inbox.ts. The
  // (a < x OR (a = x AND b < y)) form is the portable spelling of the
  // row-value comparison (a, b) < (x, y).
  const result = await env.DB.prepare(
    `${APPLICATION_ROW_SELECT}
     WHERE a.user_id = ?
       AND (? IS NULL
            OR a.last_activity_at < ?
            OR (a.last_activity_at = ? AND a.id < ?))
     ORDER BY a.last_activity_at DESC, a.id DESC
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
    .all<ApplicationRowDb>()

  const rows = result.results ?? []
  const page = rows.slice(0, limit)
  const last = page[page.length - 1]
  const nextCursor =
    rows.length > limit && last
      ? encodeCursor({ t: last.last_activity_at, id: last.id })
      : null

  const response = ApplicationsResponseSchema.parse({
    applications: page.map(mapApplicationRow),
    nextCursor,
  })

  return Response.json(response)
}

// PATCH /api/applications/:id/status — the manual status pin. Sets
// status_source='user' so the ingestion pipeline stops overwriting status
// on this application until the user edits it again (db/applications.ts
// setApplicationStatusByUser, orchestrator.ts step 3b). Mail on a pinned
// application still ingests and still bumps last_activity_at; only status
// is frozen.
export async function handleApplicationStatusPatch(
  req: Request,
  env: Env,
  userId: string,
  id: string,
): Promise<Response> {
  if (req.method !== 'PATCH') {
    return new Response('method not allowed', { status: 405 })
  }

  let body: z.infer<typeof StatusUpdateBodySchema>
  try {
    body = StatusUpdateBodySchema.parse(await req.json())
  } catch {
    return new Response('invalid body', { status: 400 })
  }

  const now = new Date().toISOString()
  const row = await setApplicationStatusByUser(env.DB, {
    userId,
    id,
    status: body.status,
    now,
  })

  // Never distinguish "no such application" from "exists, but not yours" —
  // both 404. setApplicationStatusByUser already scopes its UPDATE to
  // (id, user_id), so this covers both cases for free.
  if (!row) {
    return new Response('not found', { status: 404 })
  }

  return Response.json(ApplicationRowSchema.parse(row))
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
