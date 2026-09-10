import { Logo } from '../Logo'
import { StatusPill } from '../StatusPill'
import type { StatusKey } from '../../_lib/types'
import { relativeTime } from '../../_lib/format'

type RecentRow = {
  id: string
  company: string
  role: string
  eventType: string
  previousStatus: string | null
  reason: string | null
  occurredAt: string
}

// event_type uses 'interview' (singular); application status uses
// 'interviewing'. Inverse of the orchestrator's eventTypeForStatus() —
// declared locally since the web app doesn't share code with apps/agents.
const STATUS_LABELS: Record<string, string> = {
  applied: 'applied',
  replied: 'replied',
  interview: 'interviewing',
  interviewing: 'interviewing',
  offer: 'offer',
  closed: 'closed',
}

// 'closed' has no dedicated .status.closed CSS class — map it to the
// existing 'rejected' pill styling.
function pillStatusForEventType(eventType: string): StatusKey {
  if (eventType === 'closed') return 'rejected'
  return eventType as StatusKey
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
                <StatusPill status={pillStatusForEventType(r.eventType)}>
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
