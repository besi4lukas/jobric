import { z } from 'zod'
import type { Env } from '../types'
import { ApplicationStatusSchema, EventTypeSchema } from '../db/schema'

// HTTP route for the dashboard Overview page.
//
// Deliberately not on OrchestratorAgent. getApplications lives on that DO
// (orchestrator.ts), but these are plain D1 reads needing no DO state, and
// the Orchestrator is a global singleton (techdebt #5) that serializes
// multi-second LLM calls. Routing a dashboard load through it would queue
// page renders behind email parsing.

// Zero-filled server-side so the UI always renders five bars, in the same
// order as ApplicationStatusSchema (applied, replied, interviewing, offer,
// closed) — the order the mockup renders them in.
const STATUS_ORDER = ApplicationStatusSchema.options

// `summary` is required here (Worker side) but `.optional()` with a default
// on the web side (apps/web/.../dashboard/_lib/overview-schema.ts) —
// deliberately asymmetric, do not "fix" this by making them match. Zod
// strips unknown keys, so an old deployed web app parsing a NEW worker's
// response (which always includes `summary`) is unaffected either way; but
// a NEW web app parsing an OLD worker's response (which lacks `summary`
// entirely, e.g. mid-deploy) would throw on a required field and blank the
// whole page.
// Requiring it here keeps the Worker's own contract honest; defaulting it
// web-side is what makes that transition survivable. See overview-schema.ts.
const OverviewResponseSchema = z.object({
  account: z.object({
    connected: z.boolean(),
    email: z.string().email().optional(),
    connectedAt: z.string().optional(),
    lastSyncedAt: z.string().nullable().optional(),
  }),
  counts: z.object({
    tracked: z.number().int().nonnegative(),
    open: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
  }),
  breakdown: z.array(
    z.object({
      status: ApplicationStatusSchema,
      n: z.number().int().nonnegative(),
    }),
  ),
  recent: z.array(
    z.object({
      id: z.string(),
      company: z.string(),
      role: z.string(),
      eventType: EventTypeSchema,
      previousStatus: ApplicationStatusSchema.nullable(),
      reason: z.string().nullable(),
      occurredAt: z.string(),
    }),
  ),
  summary: z.object({
    state: z.enum(['ready', 'pending', 'unavailable']),
    headline: z.string().nullable(),
    body: z.string().nullable(),
    generatedAt: z.string().nullable(),
  }),
})

type CountsRow = {
  tracked: number
  open: number | null
  active: number | null
}

type BreakdownRow = { status: string; n: number }

type RecentRow = {
  id: string
  company: string
  role: string
  event_type: string
  metadata: string | null
  occurred_at: string
}

type AccountRow = {
  email: string
  created_at: string
  last_polled_at: string | null
}

type SummaryRow = {
  headline: string | null
  body: string | null
  generated_at: string | null
}

export async function handleOverview(
  req: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('method not allowed', { status: 405 })
  }

  const [countsResult, breakdownResult, recentResult, accountResult] =
    await env.DB.batch<CountsRow | BreakdownRow | RecentRow | AccountRow>([
      env.DB.prepare(
        `SELECT COUNT(*) AS tracked,
                SUM(funnel_rank > 0) AS open,
                SUM(funnel_rank >= 3) AS active
         FROM applications
         WHERE user_id = ?`,
      ).bind(userId),
      env.DB.prepare(
        `SELECT status, COUNT(*) AS n
         FROM applications
         WHERE user_id = ?
         GROUP BY status`,
      ).bind(userId),
      env.DB.prepare(
        `SELECT e.id, c.name AS company, a.role_title AS role,
                e.event_type, e.metadata, e.occurred_at
         FROM events e
         JOIN applications a ON a.id = e.application_id
         JOIN companies c ON c.id = a.company_id
         WHERE e.user_id = ?
         ORDER BY e.occurred_at DESC
         LIMIT 8`,
      ).bind(userId),
      env.DB.prepare(
        `SELECT email, created_at, last_polled_at
         FROM email_accounts
         WHERE user_id = ?
         LIMIT 1`,
      ).bind(userId),
    ])

  // noUncheckedIndexedAccess means destructuring a fixed-length batch()
  // result still types each element as possibly undefined. D1 guarantees
  // one result per statement, so this can only trip if the batch call
  // itself is malformed — fail loud rather than silently reading `undefined`.
  if (!countsResult || !breakdownResult || !recentResult || !accountResult) {
    throw new Error('overview batch query returned fewer results than expected')
  }

  const countsRow = (countsResult.results[0] as CountsRow | undefined) ?? {
    tracked: 0,
    open: 0,
    active: 0,
  }

  const breakdownByStatus = new Map<string, number>()
  for (const row of breakdownResult.results as BreakdownRow[]) {
    breakdownByStatus.set(row.status, row.n)
  }
  const breakdown = STATUS_ORDER.map((status) => ({
    status,
    n: breakdownByStatus.get(status) ?? 0,
  }))

  const recent = (recentResult.results as RecentRow[]).map((row) => {
    // metadata is TEXT holding JSON ({reason, previousStatus}) written by the
    // orchestrator. Parse defensively — omit the reason line rather than
    // throwing if it's ever malformed or absent.
    let reason: string | null = null
    let previousStatus: string | null = null
    if (row.metadata) {
      try {
        const parsed = JSON.parse(row.metadata) as {
          reason?: unknown
          previousStatus?: unknown
        }
        if (typeof parsed.reason === 'string') reason = parsed.reason
        if (typeof parsed.previousStatus === 'string') {
          previousStatus = parsed.previousStatus
        }
      } catch {
        // malformed metadata — fall through with reason/previousStatus null
      }
    }
    return {
      id: row.id,
      company: row.company,
      role: row.role,
      eventType: row.event_type,
      previousStatus,
      reason,
      occurredAt: row.occurred_at,
    }
  })

  const accountRow = accountResult.results[0] as AccountRow | undefined
  const account = accountRow
    ? {
        connected: true,
        email: accountRow.email,
        connectedAt: accountRow.created_at,
        lastSyncedAt: accountRow.last_polled_at,
      }
    : { connected: false }

  // Deliberately OUTSIDE env.DB.batch([...]) above, with its own try/catch.
  // A D1 batch fails as a unit, so a missing/mid-migration user_summaries
  // table INSIDE the batch would blank the entire Overview page. Out here,
  // a failed read degrades to state: 'unavailable' and everything else
  // (stats, funnel, recent activity) still renders. Never issue an LLM call
  // on this path — generation only happens from the cron tick.
  const summary = await readSummary(env, userId)

  const response = OverviewResponseSchema.parse({
    account,
    counts: {
      tracked: countsRow.tracked,
      open: countsRow.open ?? 0,
      active: countsRow.active ?? 0,
    },
    breakdown,
    recent,
    summary,
  })

  return Response.json(response)
}

async function readSummary(
  env: Env,
  userId: string,
): Promise<{
  state: 'ready' | 'pending' | 'unavailable'
  headline: string | null
  body: string | null
  generatedAt: string | null
}> {
  try {
    const row = await env.DB.prepare(
      `SELECT headline, body, generated_at FROM user_summaries WHERE user_id = ?`,
    )
      .bind(userId)
      .first<SummaryRow>()

    if (row?.headline && row?.body) {
      return {
        state: 'ready',
        headline: row.headline,
        body: row.body,
        generatedAt: row.generated_at,
      }
    }

    // No row yet, or a row with no text (failed first attempt) — both are
    // "not ready yet", not an error.
    return { state: 'pending', headline: null, body: null, generatedAt: null }
  } catch (err) {
    console.error('overview summary read failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      state: 'unavailable',
      headline: null,
      body: null,
      generatedAt: null,
    }
  }
}
