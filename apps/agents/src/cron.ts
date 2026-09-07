import { decryptRefreshToken } from './lib/crypto'
import { getAccessToken, listHistory, getMessage } from './gmail/client'
import { generateOverviewSummary } from './lib/overview-summary'
import type { Env, EmailEnvelope } from './types'

// Forward-only Gmail polling. Invariant: email_accounts.last_history_id is
// set at connect time to the user's CURRENT historyId, so the first poll
// after connect only sees messages that arrive AFTER the connect moment.
//
// Per-account isolation: a failure for one account never breaks the batch.
// We only advance last_history_id after all enqueues for that account
// succeed. If the cron crashes mid-batch, the next run replays from the
// same watermark — duplicate enqueues are absorbed by the watcher's
// UNIQUE(user_id, gmail_message_id) constraint.

type AccountRow = {
  id: string
  user_id: string
  email: string
  encrypted_refresh_token: string
  last_history_id: string | null
}

export async function runScheduledPoll(env: Env): Promise<void> {
  // Captured before any polling so the post-batch "did this account's batch
  // produce a new event" check (below) can't miss events written during
  // this very tick, and can't double-count events from a previous tick.
  const tickStartedAt = new Date().toISOString()

  const result = await env.DB.prepare(
    `SELECT id, user_id, email, encrypted_refresh_token, last_history_id
     FROM email_accounts
     WHERE last_history_id IS NOT NULL`,
  ).all<AccountRow>()

  const accounts = result.results ?? []
  log('cron poll started', { accounts: accounts.length })

  let totalNewMessages = 0

  for (const account of accounts) {
    try {
      const newCount = await pollAccount(account, env)
      totalNewMessages += newCount

      // Overview summary generation — coalesced to at most once per account
      // per tick, and only when this account's batch actually produced a
      // status change. This is safe to sequence here because cron.ts awaits
      // the watcher, which awaits the orchestrator, so all D1 writes for the
      // batch are complete by the time pollAccount returns. Never on the
      // read path (routes/overview.ts) — see lib/overview-summary.ts.
      //
      // Wrapped in its own try/catch, separate from the poll-failure catch
      // below: a summary failure must never look like a poll failure (which
      // would otherwise pin the watermark), and must never affect it.
      if (newCount > 0) {
        try {
          const changedResult = await env.DB.prepare(
            `SELECT COUNT(*) AS n FROM events
             WHERE user_id = ? AND occurred_at >= ?`,
          )
            .bind(account.user_id, tickStartedAt)
            .first<{ n: number }>()

          if ((changedResult?.n ?? 0) > 0) {
            await generateOverviewSummary(env, account.user_id)
          }
        } catch (err) {
          log('cron overview summary check failed', {
            userId: account.user_id,
            error: errorMessage(err),
          })
        }
      }
    } catch (err) {
      // Per-account isolation. Logging the userId is fine; never the email
      // address, refresh_token, message content, or anything else sensitive.
      log('cron poll account failed', {
        userId: account.user_id,
        error: errorMessage(err),
      })
    }
  }

  log('cron poll completed', {
    accounts: accounts.length,
    newMessages: totalNewMessages,
  })
}

async function pollAccount(account: AccountRow, env: Env): Promise<number> {
  // Defensive — the SELECT filters out null, but TS can't see that.
  if (!account.last_history_id) return 0

  const refreshToken = await decryptRefreshToken(
    account.encrypted_refresh_token,
    env.GMAIL_TOKEN_KEY,
  )
  const accessToken = await getAccessToken(
    refreshToken,
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
  )

  const { messageIds, newHistoryId } = await listHistory(
    accessToken,
    account.last_history_id,
  )

  if (messageIds.length > 0) {
    const watcherStub = env.EmailWatcherAgent.get(
      env.EmailWatcherAgent.idFromName('watcher'),
    )

    for (const messageId of messageIds) {
      const message = await getMessage(accessToken, messageId)
      const envelope: EmailEnvelope = {
        userId: account.user_id,
        from: message.from,
        to: message.to,
        subject: message.subject,
        rawSize: message.sizeEstimate,
        // Required for parse_failures capture downstream.
        gmailMessageId: message.id,
      }
      const enqueueResponse = await watcherStub.fetch(
        'https://internal/email',
        {
          method: 'POST',
          body: JSON.stringify(envelope),
        },
      )
      if (!enqueueResponse.ok) {
        // Bail before advancing the watermark — next run will retry.
        throw new Error(
          `watcher enqueue failed: status=${enqueueResponse.status}`,
        )
      }
    }
  }

  await env.DB.prepare(
    `UPDATE email_accounts
       SET last_history_id = ?, last_polled_at = ?
     WHERE id = ?`,
  )
    .bind(newHistoryId, new Date().toISOString(), account.id)
    .run()

  return messageIds.length
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function log(message: string, data?: unknown) {
  console.log(JSON.stringify({ message, data, ts: new Date().toISOString() }))
}
