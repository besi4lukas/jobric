import type { ApplicationRow } from '../../_lib/applications-schema'
import { emailCountLabel, formatShortDate, threadTime } from '../../_lib/format'
import { PILL_LABELS, pillStatusFor } from '../../_lib/status'
import { Logo } from '../Logo'
import { StatusPill } from '../StatusPill'

// Root is an <article>, not a <button> — PR C puts a <select> in here to
// edit status, and a <select> inside a <button> is invalid HTML.
export function ApplicationCard({
  application,
}: {
  application: ApplicationRow
}) {
  const interview = upcomingInterview(application.interviewAt)

  return (
    <article className="application-card">
      <div className="top">
        <Logo>{application.company.charAt(0).toUpperCase()}</Logo>
        <div>
          <h4>{application.company}</h4>
          <div className="role">{application.role}</div>
        </div>
      </div>
      <div className="mid">
        <StatusPill status={pillStatusFor(application.status)}>
          {PILL_LABELS[application.status] ?? application.status}
        </StatusPill>
        {application.statusSource === 'user' && (
          <span className="status-note">set by you</span>
        )}
        <span className="emails">
          {emailCountLabel(application.emailCount)}
        </span>
      </div>
      <div className="last">
        <span>
          {application.requisitionId
            ? `Req ${application.requisitionId}`
            : interview
              ? `Interview ${interview}`
              : ''}
        </span>
        <span className="w">{threadTime(application.lastActivityAt)}</span>
      </div>
    </article>
  )
}

// Only worth surfacing on the card if it hasn't happened yet.
function upcomingInterview(interviewAt: string | null): string | null {
  if (!interviewAt) return null
  const at = new Date(interviewAt).getTime()
  if (Number.isNaN(at) || at <= Date.now()) return null
  return formatShortDate(interviewAt)
}
