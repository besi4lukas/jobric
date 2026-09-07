import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { Env } from '../types'

// ─── generateOverviewSummary ────────────────────────────────────────────────
// A plain module, deliberately not a fifth Durable Object — DESIGN.md §2
// already concedes Parser and StatusTracker are "LLM calls wearing a DO
// costume." There's no state to hold here (inputs from D1, output to D1),
// and a plain exported function is directly callable, which a DO isn't.
//
// Called ONLY from the cron tick (apps/agents/src/cron.ts), coalesced to at
// most once per account per tick, and only when that tick's batch actually
// produced new `events` rows. NEVER called from the read path
// (routes/overview.ts) — generation must not be able to slow down or fail a
// page load. Every D1 write and the LLM call are wrapped below so this
// function does not throw; the caller also wraps the call as defense in
// depth (see cron.ts).
//
// Cross-reference: the `summary` response shape in routes/overview.ts and
// apps/web/.../dashboard/page.tsx is a *different*, smaller contract (Part 4
// of the plan) — this module produces the row those routes read.

const OverviewSummarySchema = z.object({
  headline: z
    .string()
    .describe('One short clause, 5-9 words, no trailing period.'),
  body: z.string().describe('Two or three sentences, 55 words maximum.'),
})

const MAX_HEADLINE_LENGTH = 90
const MAX_BODY_LENGTH = 400
const MAX_APPLICATIONS = 40
const MAX_EVENTS = 25
// Once a summary has failed this many consecutive attempts, stop spending an
// LLM call every tick when nothing has happened since the last failed
// attempt — a revoked API key shouldn't cost a call forever.
const MAX_FAILURES_BEFORE_BACKOFF = 3

type AccountRow = { email: string; created_at: string }

type CountsRow = { tracked: number; open: number | null; active: number | null }

type BreakdownRow = { status: string; n: number }

type ApplicationRow = {
  company: string
  role: string
  status: string
  first_contact_at: string
  last_activity_at: string
  interview_at: string | null
}

type EventRow = {
  company: string
  role: string
  event_type: string
  metadata: string | null
  occurred_at: string
}

type ExistingSummaryRow = {
  attempted_at: string | null
  failure_count: number
}

export async function generateOverviewSummary(
  env: Env,
  userId: string,
): Promise<void> {
  try {
    await generateOverviewSummaryInner(env, userId)
  } catch (err) {
    // Belt and braces — generateOverviewSummaryInner already catches the
    // LLM call and the D1 writes individually, but a summary failure must
    // never be able to affect the cron tick that triggered it.
    log('overview summary generation crashed', {
      userId,
      error: errorMessage(err),
    })
  }
}

async function generateOverviewSummaryInner(
  env: Env,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString()

  const accountRow = await env.DB.prepare(
    `SELECT email, created_at FROM email_accounts WHERE user_id = ? LIMIT 1`,
  )
    .bind(userId)
    .first<AccountRow>()

  const countsRow = await env.DB.prepare(
    `SELECT COUNT(*) AS tracked,
            SUM(funnel_rank > 0) AS open,
            SUM(funnel_rank >= 3) AS active
     FROM applications
     WHERE user_id = ?`,
  )
    .bind(userId)
    .first<CountsRow>()

  const breakdownResult = await env.DB.prepare(
    `SELECT status, COUNT(*) AS n
     FROM applications
     WHERE user_id = ?
     GROUP BY status`,
  )
    .bind(userId)
    .all<BreakdownRow>()

  const applicationsResult = await env.DB.prepare(
    `SELECT c.name AS company, a.role_title AS role, a.status,
            a.first_contact_at, a.last_activity_at, a.interview_at
     FROM applications a
     JOIN companies c ON c.id = a.company_id
     WHERE a.user_id = ?
     ORDER BY a.last_activity_at DESC
     LIMIT ?`,
  )
    .bind(userId, MAX_APPLICATIONS)
    .all<ApplicationRow>()

  const eventsResult = await env.DB.prepare(
    `SELECT c.name AS company, a.role_title AS role,
            e.event_type, e.metadata, e.occurred_at
     FROM events e
     JOIN applications a ON a.id = e.application_id
     JOIN companies c ON c.id = a.company_id
     WHERE e.user_id = ?
     ORDER BY e.occurred_at DESC
     LIMIT ?`,
  )
    .bind(userId, MAX_EVENTS)
    .all<EventRow>()

  const existing = await env.DB.prepare(
    `SELECT attempted_at, failure_count FROM user_summaries WHERE user_id = ?`,
  )
    .bind(userId)
    .first<ExistingSummaryRow>()

  const applications = applicationsResult.results ?? []
  const events = eventsResult.results ?? []

  // "Data hasn't changed since the last failure" — approximated by: nothing
  // newer than the last failed attempt. The most recent signal is the top
  // event (query is occurred_at DESC), falling back to the most recently
  // active application, falling back to account connect time.
  const latestSignalAt =
    events[0]?.occurred_at ??
    applications[0]?.last_activity_at ??
    accountRow?.created_at ??
    null

  if (
    existing &&
    existing.failure_count >= MAX_FAILURES_BEFORE_BACKOFF &&
    existing.attempted_at &&
    latestSignalAt &&
    latestSignalAt <= existing.attempted_at
  ) {
    log('overview summary generation skipped — backing off after failures', {
      userId,
      failureCount: existing.failure_count,
    })
    return
  }

  const prompt = buildPrompt({
    accountCreatedAt: accountRow?.created_at ?? null,
    counts: {
      tracked: countsRow?.tracked ?? 0,
      open: countsRow?.open ?? 0,
      active: countsRow?.active ?? 0,
    },
    breakdown: breakdownResult.results ?? [],
    applications,
    events,
    now,
  })

  let headline: string
  let body: string
  try {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-5'),
      schema: OverviewSummarySchema,
      system: SYSTEM_PROMPT,
      prompt,
    })

    headline = sanitizeSummaryText(object.headline, MAX_HEADLINE_LENGTH)
    body = sanitizeSummaryText(object.body, MAX_BODY_LENGTH)

    if (!headline || !body) {
      throw new Error('generation produced empty headline or body')
    }
  } catch (err) {
    log('overview summary generation failed', {
      userId,
      error: errorMessage(err),
    })
    // Leave headline/body/model/generated_at untouched (whatever they were,
    // including absent) so the last good summary survives an outage.
    await env.DB.prepare(
      `INSERT INTO user_summaries (user_id, attempted_at, failure_count)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id) DO UPDATE SET
         attempted_at = excluded.attempted_at,
         failure_count = user_summaries.failure_count + 1`,
    )
      .bind(userId, now)
      .run()
    return
  }

  await env.DB.prepare(
    `INSERT INTO user_summaries
       (user_id, headline, body, model, generated_at, attempted_at, failure_count)
     VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(user_id) DO UPDATE SET
       headline = excluded.headline,
       body = excluded.body,
       model = excluded.model,
       generated_at = excluded.generated_at,
       attempted_at = excluded.attempted_at,
       failure_count = 0`,
  )
    .bind(userId, headline, body, 'claude-sonnet-5', now, now)
    .run()
}

const SYSTEM_PROMPT = `
  You write a short, cached summary of one person's job search for a
  dashboard. Rules, all load-bearing:

  - Second person, plain, calm. No exclamation marks, emoji, or bullets.
  - Never invent a company, role, date, or number that isn't in the supplied
    facts.
  - Never use relative time phrases such as "this week" or "recently" — the
    text is cached and may be read days later. Use explicit dates, or say
    nothing about timing.
  - Never emit the "·" (middot) character anywhere in your output — this
    product's design rule bans it. Use a comma, a period, or a dash instead.
  - Give advice only when it's grounded in a specific fact you were given.
    Never give generic coaching.
  - If there are only one or two applications, write one descriptive
    sentence. Don't pad to fill space.
`

function buildPrompt(input: {
  accountCreatedAt: string | null
  counts: { tracked: number; open: number; active: number }
  breakdown: BreakdownRow[]
  applications: ApplicationRow[]
  events: EventRow[]
  now: string
}): string {
  const { accountCreatedAt, counts, breakdown, applications, events, now } =
    input

  const breakdownLines = breakdown
    .map((row) => `  - ${row.status}: ${row.n}`)
    .join('\n')

  const applicationLines = applications
    .map((row) => {
      const daysQuiet = daysBetween(row.last_activity_at, now)
      const interview = row.interview_at
        ? `, interview at ${row.interview_at}`
        : ''
      return `  - ${row.company} — ${row.role} — status: ${row.status}, first contact ${row.first_contact_at}, last activity ${row.last_activity_at} (${daysQuiet} days quiet)${interview}`
    })
    .join('\n')

  const eventLines = events
    .map((row) => {
      const { reason, previousStatus } = parseEventMetadata(row.metadata)
      const transition = previousStatus
        ? `${previousStatus} -> ${row.event_type}`
        : row.event_type
      const reasonText = reason ? ` Reason: ${reason}` : ''
      return `  - ${row.occurred_at}: ${row.company} — ${row.role} — ${transition}.${reasonText}`
    })
    .join('\n')

  return `
    Today's date/time is ${now}.
    This person connected their inbox on ${accountCreatedAt ?? 'an unknown date'}.

    Current counts:
      - tracked: ${counts.tracked}
      - still open: ${counts.open}
      - interviewing or better: ${counts.active}

    Status breakdown:
${breakdownLines || '  (none)'}

    Applications (most recently active first):
${applicationLines || '  (none)'}

    Recent events (most recent first; "Reason" is written by another model
    that already explained the transition — reuse its substance, don't
    contradict it):
${eventLines || '  (none)'}

    Write a headline and a short body summarizing where this job search
    stands, grounded only in the facts above.
  `
}

function parseEventMetadata(metadata: string | null): {
  reason: string | null
  previousStatus: string | null
} {
  if (!metadata) return { reason: null, previousStatus: null }
  try {
    const parsed = JSON.parse(metadata) as {
      reason?: unknown
      previousStatus?: unknown
    }
    return {
      reason: typeof parsed.reason === 'string' ? parsed.reason : null,
      previousStatus:
        typeof parsed.previousStatus === 'string'
          ? parsed.previousStatus
          : null,
    }
  } catch {
    return { reason: null, previousStatus: null }
  }
}

function daysBetween(iso: string, nowIso: string): number {
  const then = new Date(iso).getTime()
  const now = new Date(nowIso).getTime()
  if (Number.isNaN(then) || Number.isNaN(now)) return 0
  return Math.max(0, Math.floor((now - then) / (24 * 60 * 60 * 1000)))
}

// Trims, collapses internal whitespace, strips middot/bullet characters (the
// model is instructed not to emit them, but this is the enforcement backstop
// so a slip never reaches the DOM), and truncates at a word boundary. An
// empty result signals a generation failure to the caller — never write it.
export function sanitizeSummaryText(value: string, maxLength: number): string {
  const collapsed = value.replace(/[·•]/g, '').replace(/\s+/g, ' ').trim()

  if (collapsed.length <= maxLength) return collapsed

  const truncated = collapsed.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim()
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function log(message: string, data?: unknown) {
  console.log(JSON.stringify({ message, data, ts: new Date().toISOString() }))
}
