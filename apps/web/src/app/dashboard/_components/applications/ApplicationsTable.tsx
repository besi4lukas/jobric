import type { ApplicationRow } from '../../_lib/applications-schema'
import { threadTime } from '../../_lib/format'
import { PILL_LABELS, pillStatusFor } from '../../_lib/status'
import { Logo } from '../Logo'
import { StatusPill } from '../StatusPill'

// Table default for the Applications tab (ViewToggle). PR C appends an
// Actions column for status editing — no empty column reserved for it here.
export function ApplicationsTable({
  applications,
}: {
  applications: ApplicationRow[]
}) {
  return (
    <div className="table-scroll">
      <table className="applications-table">
        <caption className="visually-hidden">
          Applications, most recent activity first
        </caption>
        <thead>
          <tr>
            <th scope="col">Role</th>
            <th scope="col" className="col-opt">
              Req #
            </th>
            <th scope="col">Company</th>
            <th scope="col" className="col-opt">
              Emails
            </th>
            <th scope="col">Status</th>
            <th scope="col">Last activity</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <ApplicationTableRow
              key={application.id}
              application={application}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ApplicationTableRow({ application }: { application: ApplicationRow }) {
  const full = new Date(application.lastActivityAt).toLocaleString()

  return (
    <tr>
      <td>{application.role}</td>
      <td className="col-opt mono">{application.requisitionId ?? '—'}</td>
      <td>
        <div className="company-cell">
          <Logo size="sm">{application.company.charAt(0).toUpperCase()}</Logo>
          <span>{application.company}</span>
        </div>
      </td>
      <td className="col-opt tabular-nums align-right">
        {application.emailCount}
      </td>
      <td>
        <StatusPill status={pillStatusFor(application.status)}>
          {PILL_LABELS[application.status] ?? application.status}
        </StatusPill>
        {application.statusSource === 'user' && (
          <span className="status-note">set by you</span>
        )}
      </td>
      <td>
        <time dateTime={application.lastActivityAt} title={full}>
          {threadTime(application.lastActivityAt)}
        </time>
      </td>
    </tr>
  )
}
