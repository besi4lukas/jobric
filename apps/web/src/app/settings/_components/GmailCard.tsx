import { formatShortDate, relativeTime } from '../../dashboard/_lib/format'
import type { GmailStatus } from '../_lib/gmail-status'

export function GmailCard({
  status,
  flashMessage,
}: {
  status: GmailStatus | null
  flashMessage: string | null
}) {
  return (
    <section className="card">
      <WatchingLine status={status} />
      <h2>Gmail</h2>
      <p className="blurb">
        Jobric reads job-related email from your inbox to track applications.
        Read-only access. We never send, modify, or delete email.
      </p>

      <ConnectionStatus status={status} />

      {flashMessage && <p className="flash">{flashMessage}</p>}

      <div className="card-actions">
        <a href="/api/gmail/connect" className="btn btn-primary">
          {status?.connected ? 'Reconnect Gmail' : 'Connect Gmail'}
        </a>
      </div>
    </section>
  )
}

// Moved here from the dashboard Topbar: the inbox-freshness line now lives
// with the Gmail connection it describes, rather than on the Overview header.
function WatchingLine({ status }: { status: GmailStatus | null }) {
  if (!status?.connected) return null

  const since = status.connectedAt ? formatShortDate(status.connectedAt) : null
  const checked = status.lastSyncedAt ? relativeTime(status.lastSyncedAt) : null

  return (
    <p className="watching">
      <span>
        Watching {status.email}
        {since && <> since {since}</>}
      </span>
      {checked && <span className="checked">checked {checked}</span>}
    </p>
  )
}

function ConnectionStatus({ status }: { status: GmailStatus | null }) {
  if (status === null) {
    return (
      <p className="status">
        <span className="dot" aria-hidden="true" />
        <span className="muted">Could not load connection status.</span>
      </p>
    )
  }
  if (status.connected) {
    return (
      <p className="status is-connected">
        <span className="dot" aria-hidden="true" />
        <span>Connected</span>
        <span className="addr">{status.email}</span>
      </p>
    )
  }
  return (
    <p className="status">
      <span className="dot" aria-hidden="true" />
      <span className="muted">No Gmail account connected yet.</span>
    </p>
  )
}
