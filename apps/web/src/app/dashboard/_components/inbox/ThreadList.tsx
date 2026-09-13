'use client'

import { useState, useTransition } from 'react'
import { loadInboxPage } from '../../_actions/inbox'
import { threadTime } from '../../_lib/format'
import type { InboxResponse, InboxThread } from '../../_lib/inbox-schema'
import { PILL_LABELS, pillStatusFor } from '../../_lib/status'
import { Logo } from '../Logo'
import { StatusPill } from '../StatusPill'

// First page arrives from the server (page.tsx → Dashboard → InboxView);
// later pages append via the loadInboxPage server action. The Worker's
// cursor is keyset on (last_message_at, id), so appending is safe even when
// new mail has landed at the top since the first page — nothing repeats.
export function ThreadList({ initial }: { initial: InboxResponse }) {
  const [threads, setThreads] = useState<InboxThread[]>(initial.threads)
  const [nextCursor, setNextCursor] = useState<string | null>(
    initial.nextCursor,
  )
  const [failed, setFailed] = useState(false)
  const [isPending, startTransition] = useTransition()

  function loadMore() {
    if (!nextCursor) return
    const cursor = nextCursor
    setFailed(false)
    startTransition(async () => {
      const page = await loadInboxPage(cursor)
      if (!page) {
        setFailed(true)
        return
      }
      setThreads((current) => [...current, ...page.threads])
      setNextCursor(page.nextCursor)
    })
  }

  return (
    <div className="thread-list">
      <div className="thread-scroller">
        {threads.map((t) => (
          <ThreadRow key={t.id} thread={t} />
        ))}
        {nextCursor && (
          <div className="thread-more">
            <button
              type="button"
              onClick={loadMore}
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? 'Loading…' : 'Load more'}
            </button>
            {failed && (
              <span className="thread-more-error" role="status">
                Couldn&rsquo;t load more. Try again.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ThreadRow({ thread }: { thread: InboxThread }) {
  const pending = thread.summaryState === 'pending' || !thread.summary
  const when = threadTime(thread.lastMessageAt)

  return (
    <div className="thread">
      <Logo size="sm">{thread.company.charAt(0).toUpperCase()}</Logo>
      <div>
        <div className="co">
          <span>{thread.company}</span>
          {when && (
            <span>
              <time dateTime={thread.lastMessageAt}>{when}</time>
            </span>
          )}
        </div>
        <div className="role">{thread.role}</div>
        {pending ? (
          // No summary yet — the cron tick hasn't reached this thread. Show
          // the newest subject so the row still says something concrete.
          <div className="summary pending">
            {thread.lastSubject ?? 'Summary pending'}
          </div>
        ) : (
          <div className="summary">{thread.summary}</div>
        )}
        <div className="foot">
          <StatusPill status={pillStatusFor(thread.status)}>
            {PILL_LABELS[thread.status] ?? thread.status}
          </StatusPill>
          <span className="count">
            {thread.messageCount} message{thread.messageCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
}
