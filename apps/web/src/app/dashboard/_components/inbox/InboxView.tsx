import Link from 'next/link'
import type { InboxResponse } from '../../_lib/inbox-schema'
import { ThreadList } from './ThreadList'

// Mirrors OverviewView's three non-list states so the two tabs agree about
// what "nothing here" means. `connected` comes from the overview payload
// (the inbox response has no account block of its own); null when the
// overview fetch failed, in which case we fall through to the inbox's own
// null check rather than guess.
export function InboxView({
  inbox,
  connected,
}: {
  inbox: InboxResponse | null
  connected: boolean | null
}) {
  if (connected === false) {
    return (
      <section className="view active">
        <div className="card">
          <h3>Connect Gmail to get started</h3>
          <p className="empty-hint">
            The AI Inbox summarises job-related threads from your Gmail.{' '}
            <Link href="/settings" style={{ color: 'var(--accent)' }}>
              Connect Gmail
            </Link>{' '}
            to begin.
          </p>
        </div>
      </section>
    )
  }

  // Fetch failed — an error, not an empty inbox.
  if (!inbox) {
    return (
      <section className="view active">
        <div className="card">
          <p className="empty-hint">Couldn&rsquo;t load your inbox.</p>
        </div>
      </section>
    )
  }

  if (inbox.threads.length === 0) {
    return (
      <section className="view active">
        <div className="card">
          <p className="empty-hint">
            <strong>Nothing yet.</strong> Threads appear here as job-related
            mail arrives — Jobric only reads mail that lands after you
            connected, and checks every few minutes.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="view active">
      <ThreadList initial={inbox} />
    </section>
  )
}
