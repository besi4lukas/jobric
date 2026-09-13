import type { D1Database } from '@cloudflare/workers-types'
import type { EmailEnvelope } from '../types'

// ─── Inbox writes: threads + messages ────────────────────────────────────────
// The AI Inbox's data source. One `threads` row per Gmail thread, bound to
// the application it was first seen under; one `messages` row per Gmail
// message (snippet only — no body, see 0001_schema_v1.sql).
//
// Plain functions over D1 rather than OrchestratorAgent methods so the SQL is
// testable without a Durable Object harness (db/__tests__/inbox.test.ts runs
// the real migrations against node:sqlite).
//
// Idempotency is the whole design. cron.ts replays a batch from the same
// watermark after any mid-batch failure, so every write here must be safe to
// run twice with the same input:
//   - inserts use ON CONFLICT DO NOTHING on the natural keys
//   - message_count / last_message_at are RECOMPUTED from messages rows,
//     never incremented, so a replay can't drift them.

export type InboxMessageInput = {
  userId: string
  gmailMessageId: string
  gmailThreadId: string
  fromAddress: string
  toAddress: string
  subject: string | null
  snippet: string | null
  sentAt: string
}

export type KnownThread = { id: string; applicationId: string }

export type RecordedMessage = {
  threadId: string
  messageId: string
  messageCount: number
}

// Cron path envelopes carry gmailMessageId + gmailThreadId; the Cloudflare
// Email Workers path carries neither. Without both ids there is nothing to
// key a thread or dedup a message on, so the pipeline records no inbox row.
// `now` is the fallback for sentAt when Gmail omitted internalDate.
export function inboxInputFromEnvelope(
  envelope: EmailEnvelope,
  now: string,
): InboxMessageInput | null {
  if (!envelope.gmailMessageId || !envelope.gmailThreadId) return null
  return {
    userId: envelope.userId,
    gmailMessageId: envelope.gmailMessageId,
    gmailThreadId: envelope.gmailThreadId,
    fromAddress: envelope.from,
    toAddress: envelope.to,
    subject: envelope.subject || null,
    snippet: envelope.snippet || null,
    sentAt: envelope.sentAt ?? now,
  }
}

// Called BEFORE the parser so a replayed message costs zero LLM calls.
export async function hasProcessedMessage(
  db: D1Database,
  userId: string,
  gmailMessageId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS present FROM messages
       WHERE user_id = ? AND gmail_message_id = ?
       LIMIT 1`,
    )
    .bind(userId, gmailMessageId)
    .first<{ present: number }>()
  return row !== null
}

// A known thread anchors the application: later messages in the same Gmail
// thread belong to the application the thread was first bound to, whatever
// the parser says about company/role this time round.
export async function findThreadByGmailId(
  db: D1Database,
  userId: string,
  gmailThreadId: string,
): Promise<KnownThread | null> {
  const row = await db
    .prepare(
      `SELECT id, application_id FROM threads
       WHERE user_id = ? AND gmail_thread_id = ?
       LIMIT 1`,
    )
    .bind(userId, gmailThreadId)
    .first<{ id: string; application_id: string }>()
  if (!row) return null
  return { id: row.id, applicationId: row.application_id }
}

// One D1 batch (transactional): ensure the thread exists, insert the message,
// recompute the thread's derived columns, read back ids. `applicationId` is
// only used when the thread is new — an existing thread keeps its binding.
export async function recordMessage(
  db: D1Database,
  applicationId: string,
  input: InboxMessageInput,
): Promise<RecordedMessage> {
  const { userId, gmailThreadId, gmailMessageId } = input

  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO threads (id, user_id, application_id, gmail_thread_id,
                              message_count, last_message_at)
         VALUES (?, ?, ?, ?, 0, NULL)
         ON CONFLICT (user_id, gmail_thread_id) DO NOTHING`,
      )
      .bind(crypto.randomUUID(), userId, applicationId, gmailThreadId),
    db
      .prepare(
        `INSERT INTO messages (id, user_id, thread_id, gmail_message_id,
                               from_address, to_address, subject, snippet,
                               sent_at, processed_at)
         VALUES (?, ?,
                 (SELECT id FROM threads WHERE user_id = ? AND gmail_thread_id = ?),
                 ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, gmail_message_id) DO NOTHING`,
      )
      .bind(
        crypto.randomUUID(),
        userId,
        userId,
        gmailThreadId,
        gmailMessageId,
        input.fromAddress,
        input.toAddress,
        input.subject,
        input.snippet,
        input.sentAt,
        new Date().toISOString(),
      ),
    db
      .prepare(
        `UPDATE threads
            SET message_count   = (SELECT COUNT(*)      FROM messages m WHERE m.thread_id = threads.id),
                last_message_at = (SELECT MAX(m.sent_at) FROM messages m WHERE m.thread_id = threads.id)
          WHERE user_id = ? AND gmail_thread_id = ?`,
      )
      .bind(userId, gmailThreadId),
    db
      .prepare(
        `SELECT t.id AS thread_id, t.message_count, m.id AS message_id
           FROM threads t
           JOIN messages m ON m.thread_id = t.id
          WHERE t.user_id = ? AND t.gmail_thread_id = ? AND m.gmail_message_id = ?`,
      )
      .bind(userId, gmailThreadId, gmailMessageId),
  ])

  // See the noUncheckedIndexedAccess note in routes/overview.ts: D1 returns
  // one result per statement, so a short array means the batch itself broke.
  const readback = results[3]?.results[0] as
    | { thread_id: string; message_count: number; message_id: string }
    | undefined
  if (!readback) {
    throw new Error('recordMessage: thread/message readback returned no row')
  }

  return {
    threadId: readback.thread_id,
    messageId: readback.message_id,
    messageCount: readback.message_count,
  }
}
