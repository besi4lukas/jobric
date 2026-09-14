import Link from 'next/link'
import type { ApplicationsResponse } from '../../_lib/applications-schema'
import { ApplicationList } from './ApplicationList'

// Mirrors InboxView's three non-list states so every tab agrees about what
// "nothing here" means. `connected` comes from the overview payload (the
// applications response has no account block of its own); null when the
// overview fetch failed, in which case we fall through to the applications
// fetch's own null check rather than guess.
export function ApplicationsView({
  applications,
  connected,
}: {
  applications: ApplicationsResponse | null
  connected: boolean | null
}) {
  if (connected === false) {
    return (
      <section className="view active">
        <div className="card">
          <h3>Connect Gmail to get started</h3>
          <p className="empty-hint">
            Jobric tracks your applications from job-related Gmail threads.{' '}
            <Link href="/settings" style={{ color: 'var(--accent)' }}>
              Connect Gmail
            </Link>{' '}
            to begin.
          </p>
        </div>
      </section>
    )
  }

  // Fetch failed — an error, not an empty list.
  if (!applications) {
    return (
      <section className="view active">
        <div className="card">
          <p className="empty-hint">Couldn&rsquo;t load your applications.</p>
        </div>
      </section>
    )
  }

  if (applications.applications.length === 0) {
    return (
      <section className="view active">
        <div className="card">
          <p className="empty-hint">
            <strong>Nothing yet.</strong> Applications appear here as
            job-related mail arrives — Jobric only reads mail that lands after
            you connected, and checks every few minutes.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="view active">
      <ApplicationList initial={applications} />
    </section>
  )
}
