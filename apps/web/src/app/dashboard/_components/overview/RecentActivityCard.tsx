import { Logo } from '../Logo'
import { StatusPill } from '../StatusPill'
import { relativeTime } from '../../_lib/format'
import { STATUS_LABELS, pillStatusFor } from '../../_lib/status'

type RecentRow = {
  id: string
  company: string
  role: string
  eventType: string
  previousStatus: string | null
  reason: string | null
  occurredAt: string
}

function transitionLabel(
  eventType: string,
  previousStatus: string | null,
): string {
  const to = STATUS_LABELS[eventType] ?? eventType
  if (!previousStatus) return to
  const from = STATUS_LABELS[previousStatus] ?? previousStatus
  return `${from} → ${to}`
}

export function RecentActivityCard({ recent }: { recent: RecentRow[] }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Recent activity</h3>
        <span className="meta">auto-detected from Gmail</span>
      </div>
      {recent.length === 0 ? (
        <p className="empty-hint">Nothing yet.</p>
      ) : (
        <div className="recent-list">
          {recent.map((r) => (
            <div key={r.id} className="recent-item">
              <div className="recent-row">
                <Logo size="sm">{r.company.charAt(0).toUpperCase()}</Logo>
                <div>
                  <div className="role">{r.role}</div>
                  <div className="co">{r.company}</div>
                </div>
                <StatusPill status={pillStatusFor(r.eventType)}>
                  {transitionLabel(r.eventType, r.previousStatus)}
                </StatusPill>
                <span className="when">{relativeTime(r.occurredAt)}</span>
              </div>
              {r.reason && (
                <div className="recent-reason">&ldquo;{r.reason}&rdquo;</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
