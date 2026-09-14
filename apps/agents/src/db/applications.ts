import type { D1Database } from '@cloudflare/workers-types'
import {
  eventTypeForStatus,
  funnelRankFor,
  type ApplicationStatus,
  type StatusSource,
} from './schema'

// ─── Applications: pipeline reads/writes + the manual status pin ───────────
// Plain functions over D1, same shape as db/inbox.ts, so the SQL is testable
// without a Durable Object harness (db/__tests__/applications.test.ts runs
// the real migrations against node:sqlite).
//
// status_source (migration 0005_applications.sql) is the pin: 'gmail' means
// the ingestion pipeline owns the status; 'user' means a dashboard PATCH
// (routes/applications.ts) set it and the pipeline must not overwrite it
// until the user edits again. advanceApplication() bakes the guard into the
// UPDATE itself (a CASE on status_source) so a caller that forgets to check
// can't clobber a pinned row — belt and braces with the orchestrator's own
// step 3b check, which exists to avoid the StatusTracker LLM call, not
// because the SQL needed it to be correct.

export type ApplicationForIngest = {
  id: string
  status: ApplicationStatus
  statusSource: StatusSource
}

// The GET /api/applications list-row shape, also what PATCH returns after a
// status change (see routes/applications.ts ApplicationRowSchema).
export type ApplicationListRow = {
  id: string
  company: string
  role: string
  requisitionId: string | null
  status: ApplicationStatus
  statusSource: StatusSource
  emailCount: number
  lastActivityAt: string
  interviewAt: string | null
}

// Exported so routes/applications.ts can type its own `.all<ApplicationRowDb>()`
// call against the same shape APPLICATION_ROW_SELECT produces.
export type ApplicationRowDb = {
  id: string
  company: string
  role: string
  requisition_id: string | null
  status: string
  status_source: string
  last_activity_at: string
  interview_at: string | null
  email_count: number
}

// Shared SELECT — the FROM/JOIN/column-list that both GET /api/applications
// (routes/applications.ts, which appends its own WHERE/ORDER/LIMIT for
// pagination) and the PATCH readback below build on, so the two response
// shapes can't drift apart. email_count sums threads.message_count rather
// than counting messages directly — message_count is itself derived
// (db/inbox.ts recordMessage), so this stays correct without a second join.
export const APPLICATION_ROW_SELECT = `
  SELECT a.id, c.name AS company, a.role_title AS role, a.requisition_id,
         a.status, a.status_source, a.last_activity_at, a.interview_at,
         COALESCE((SELECT SUM(t.message_count) FROM threads t
                    WHERE t.user_id = a.user_id AND t.application_id = a.id), 0) AS email_count
  FROM applications a
  JOIN companies c ON c.id = a.company_id
`

export function mapApplicationRow(row: ApplicationRowDb): ApplicationListRow {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    requisitionId: row.requisition_id,
    status: row.status as ApplicationStatus,
    statusSource: row.status_source as StatusSource,
    emailCount: row.email_count,
    lastActivityAt: row.last_activity_at,
    interviewAt: row.interview_at,
  }
}

// Orchestrator step 2: look up an existing application by id, including
// statusSource so the pipeline knows whether it's allowed to change status
// (step 3b). Used both for the known-thread branch (id already known) and,
// after a natural-key match, for the unknown-thread branch — one query
// shape for "the enriched row this pipeline needs," instead of two bare
// `SELECT id, status` statements that would drift out of sync.
export async function findApplicationForIngest(
  db: D1Database,
  id: string,
): Promise<ApplicationForIngest | null> {
  const row = await db
    .prepare(
      `SELECT id, status, status_source FROM applications WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<{ id: string; status: string; status_source: string }>()
  if (!row) return null
  return {
    id: row.id,
    status: row.status as ApplicationStatus,
    statusSource: row.status_source as StatusSource,
  }
}

// Orchestrator step 5 (and step 3b): advance an application toward
// newStatus — unless a user pinned it, in which case status and funnel_rank
// are left untouched. The CASE guard lives in the SQL, not in application
// code, so this is safe to call even without checking statusSource first:
// step 3b calls it with the application's own current status specifically
// to touch last_activity_at/interview_at without needing a separate
// "touch-only" UPDATE. interview_at keeps the orchestrator's original
// COALESCE semantics: a later dateless email can't erase a known date, and
// this holds even for a pinned application — only status is frozen.
export async function advanceApplication(
  db: D1Database,
  params: {
    id: string
    newStatus: ApplicationStatus
    now: string
    interviewAt: string | null
  },
): Promise<void> {
  const { id, newStatus, now, interviewAt } = params
  await db
    .prepare(
      `UPDATE applications
          SET status      = CASE WHEN status_source = 'user' THEN status      ELSE ? END,
              funnel_rank = CASE WHEN status_source = 'user' THEN funnel_rank ELSE ? END,
              last_activity_at = ?,
              interview_at = COALESCE(?, interview_at)
        WHERE id = ?`,
    )
    .bind(newStatus, funnelRankFor(newStatus), now, interviewAt, id)
    .run()
}

// routes/applications.ts PATCH /api/applications/:id/status. Pins the row to
// `status` ('user') and returns the updated list-row, or null when no row
// matches (id, user_id) — the route turns that into 404, never leaking
// whether the id exists under a different user.
//
// One D1 batch (transactional): UPDATE, then — only if status actually
// changed — INSERT the audit event, then the shared readback SELECT. Which
// statements to send has to be decided before the batch is built (batch()
// runs a fixed list, it has no conditional logic of its own), so this reads
// the current status first. Re-submitting the same status still pins
// (status_source='user', last_activity_at bumped) but writes no event —
// there's nothing to say changed.
export async function setApplicationStatusByUser(
  db: D1Database,
  params: {
    userId: string
    id: string
    status: ApplicationStatus
    now: string
  },
): Promise<ApplicationListRow | null> {
  const { userId, id, status, now } = params

  const current = await db
    .prepare(
      `SELECT status FROM applications WHERE id = ? AND user_id = ? LIMIT 1`,
    )
    .bind(id, userId)
    .first<{ status: string }>()
  if (!current) return null

  const previousStatus = current.status as ApplicationStatus
  const changed = previousStatus !== status

  const statements = [
    db
      .prepare(
        `UPDATE applications
            SET status = ?, funnel_rank = ?, status_source = 'user',
                last_activity_at = ?
          WHERE id = ? AND user_id = ?`,
      )
      .bind(status, funnelRankFor(status), now, id, userId),
  ]

  if (changed) {
    statements.push(
      db
        .prepare(
          `INSERT INTO events
             (id, user_id, application_id, event_type, occurred_at,
              source, metadata, message_id)
           VALUES (?, ?, ?, ?, ?, 'user', ?, NULL)`,
        )
        .bind(
          crypto.randomUUID(),
          userId,
          id,
          eventTypeForStatus(status),
          now,
          JSON.stringify({ previousStatus, reason: null }),
        ),
    )
  }

  statements.push(
    db
      .prepare(
        `${APPLICATION_ROW_SELECT} WHERE a.user_id = ? AND a.id = ? LIMIT 1`,
      )
      .bind(userId, id),
  )

  const results = await db.batch(statements)

  // See the noUncheckedIndexedAccess note in routes/overview.ts / db/inbox.ts
  // — D1 returns one result per statement, so a short array means the batch
  // itself broke, not that the row is missing (that was already ruled out
  // by the `current` read above).
  const readback = results[results.length - 1]
  const row = readback?.results[0] as ApplicationRowDb | undefined
  if (!row) {
    throw new Error('setApplicationStatusByUser: readback returned no row')
  }

  return mapApplicationRow(row)
}
