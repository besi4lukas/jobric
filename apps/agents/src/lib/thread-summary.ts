import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { Env } from '../types'
import { sanitizeSummaryText } from './overview-summary'

// ─── refreshThreadSummaries ─────────────────────────────────────────────────
// Writes threads.summary — the one-or-two-sentence line under each row of
// the AI Inbox. Sibling of lib/overview-summary.ts and bound by the same
// rules: a plain module (no state to hold, inputs from D1, output to D1),
// called ONLY from the cron tick (apps/agents/src/cron.ts) after that
// account's batch ingested new mail, and NEVER from a read path. This
// function does not throw; the caller wraps it anyway.
//
// Staleness is implicit, no extra column: a thread needs (re)generation when
//   summary_updated_at IS NULL OR summary_updated_at < last_message_at
// and the write stamps summary_updated_at with the thread's last_message_at
// AS SELECTED — not `now` — so a message that lands while the LLM call is in
// flight still reads as stale on the next tick instead of being masked.
//
// Spend is bounded per tick by MAX_THREADS_PER_TICK, newest threads first
// (they're the ones at the top of the inbox). A thread whose generation
// keeps failing keeps its slot every tick that ingests new mail for that
// user, because there's no attempted_at to back off on — accepted for the
// beta (techdebt #22); a failure leaves the row untouched, so the last good
// summary (or the UI's "summary pending" fallback) keeps showing.

const ThreadSummarySchema = z.object({
  summary: z
    .string()
    .describe(
      'One or two sentences, 40 words maximum, describing where this thread stands.',
    ),
})

export const MAX_THREADS_PER_TICK = 10
export const MAX_MESSAGES_PER_THREAD = 15
export const MAX_SUMMARY_LENGTH = 240
const MODEL = 'claude-sonnet-5'

type StaleThreadRow = {
  id: string
  last_message_at: string
  company: string
  role: string
  status: string
}

type MessageRow = {
  from_address: string
  subject: string | null
  snippet: string | null
  sent_at: string
}

export type RefreshResult = { refreshed: number; failed: number }

export async function refreshThreadSummaries(
  env: Env,
  userId: string,
): Promise<RefreshResult> {
  try {
    return await refreshThreadSummariesInner(env, userId)
  } catch (err) {
    // Belt and braces — the inner loop already isolates each thread. This
    // only trips if the stale-thread SELECT itself fails, e.g. mid-migration.
    log('thread summary refresh crashed', { userId, error: errorMessage(err) })
    return { refreshed: 0, failed: 0 }
  }
}

async function refreshThreadSummariesInner(
  env: Env,
  userId: string,
): Promise<RefreshResult> {
  const staleResult = await env.DB.prepare(
    `SELECT t.id, t.last_message_at, c.name AS company, a.role_title AS role,
            a.status
     FROM threads t
     JOIN applications a ON a.id = t.application_id
     JOIN companies c ON c.id = a.company_id
     WHERE t.user_id = ?
       AND t.last_message_at IS NOT NULL
       AND (t.summary_updated_at IS NULL
            OR t.summary_updated_at < t.last_message_at)
     ORDER BY t.last_message_at DESC
     LIMIT ?`,
  )
    .bind(userId, MAX_THREADS_PER_TICK)
    .all<StaleThreadRow>()

  const stale = staleResult.results ?? []
  let refreshed = 0
  let failed = 0

  for (const thread of stale) {
    const ok = await summarizeThread(env, userId, thread)
    if (ok) refreshed += 1
    else failed += 1
  }

  if (stale.length > 0) {
    log('thread summaries refreshed', {
      userId,
      candidates: stale.length,
      refreshed,
      failed,
    })
  }

  return { refreshed, failed }
}

// One thread. Returns false on any failure after logging it; never throws.
async function summarizeThread(
  env: Env,
  userId: string,
  thread: StaleThreadRow,
): Promise<boolean> {
  try {
    // Newest N, then flipped so the prompt reads chronologically — a
    // thread's meaning depends on order ("we'd like to move forward" then
    // "unfortunately" is not the same as the reverse).
    const messagesResult = await env.DB.prepare(
      `SELECT from_address, subject, snippet, sent_at
       FROM messages
       WHERE user_id = ? AND thread_id = ?
       ORDER BY sent_at DESC
       LIMIT ?`,
    )
      .bind(userId, thread.id, MAX_MESSAGES_PER_THREAD)
      .all<MessageRow>()
    const messages = (messagesResult.results ?? []).reverse()

    if (messages.length === 0) {
      // last_message_at set but no rows — can't happen via recordMessage,
      // which derives one from the other in the same batch. Don't burn a
      // call on it.
      throw new Error('stale thread has no messages')
    }

    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema: ThreadSummarySchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(thread, messages),
    })

    const summary = sanitizeSummaryText(object.summary, MAX_SUMMARY_LENGTH)
    if (!summary) {
      throw new Error('generation produced an empty summary')
    }

    await env.DB.prepare(
      `UPDATE threads
          SET summary = ?, summary_updated_at = ?
        WHERE id = ? AND user_id = ?`,
    )
      .bind(summary, thread.last_message_at, thread.id, userId)
      .run()

    return true
  } catch (err) {
    // Never log message content — subjects and snippets are the user's mail.
    log('thread summary generation failed', {
      userId,
      threadId: thread.id,
      error: errorMessage(err),
    })
    return false
  }
}

const SYSTEM_PROMPT = `
  You write the one-line summary shown under an email thread in a job
  seeker's inbox. Rules, all load-bearing:

  - One or two sentences, 40 words maximum. Second person, plain, calm.
    No exclamation marks, emoji, or bullets.
  - Lead with what the latest message means for this application: what
    happened, and what (if anything) is being asked of the reader.
  - Name people only as they appear in the supplied From lines. Never
    invent a name, date, time, number, or next step that isn't in the
    supplied text.
  - Never use relative time phrases such as "today", "this week", or
    "recently" — the text is cached and may be read days later. Use the
    explicit dates given, or say nothing about timing.
  - Never emit the "·" (middot) character anywhere in your output — this
    product's design rule bans it. Use a comma, a period, or a dash.
  - You only see subject lines and short previews, not full bodies. If the
    previews don't say what happened, describe what they do say; don't
    guess at the rest.
`

function buildPrompt(thread: StaleThreadRow, messages: MessageRow[]): string {
  const messageLines = messages
    .map((m) => {
      const subject = m.subject ? ` — subject: ${m.subject}` : ''
      const snippet = m.snippet ? ` — preview: ${m.snippet}` : ''
      return `  - ${m.sent_at} — from: ${m.from_address}${subject}${snippet}`
    })
    .join('\n')

  return `
    Application: ${thread.company} — ${thread.role}.
    Current tracked status: ${thread.status}.

    Messages in this thread, oldest first (${messages.length} shown):
${messageLines}

    Write the summary line for this thread, grounded only in the text above.
  `
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function log(message: string, data?: unknown) {
  console.log(JSON.stringify({ message, data, ts: new Date().toISOString() }))
}
