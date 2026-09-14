import type {
  ApplicationRow,
  ApplicationStatus,
} from '../../_lib/applications-schema'
import { threadTime } from '../../_lib/format'
import { PILL_LABELS, pillStatusFor } from '../../_lib/status'
import { Logo } from '../Logo'
import { StatusPill } from '../StatusPill'
import { StatusSelect } from './StatusSelect'

// Table default for the Applications tab (ViewToggle). Actions column
// (status edit) is unconditional — it's never hidden at the ≤860px
// breakpoint, unlike Req # / Emails (see dashboard.css, .col-opt).
export function ApplicationsTable({
  applications,
  pendingId,
  errorId,
  onChangeStatus,
}: {
  applications: ApplicationRow[]
  pendingId: string | null
  errorId: string | null
  onChangeStatus: (id: string, status: ApplicationStatus) => void
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
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <ApplicationTableRow
              key={application.id}
              application={application}
              pending={pendingId === application.id}
              error={errorId === application.id}
              onChangeStatus={onChangeStatus}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ApplicationTableRow({
  application,
  pending,
  error,
  onChangeStatus,
}: {
  application: ApplicationRow
  pending: boolean
  error: boolean
  onChangeStatus: (id: string, status: ApplicationStatus) => void
}) {
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
      <td>
        <StatusSelect
          status={application.status}
          company={application.company}
          role={application.role}
          pending={pending}
          onChange={(status) => onChangeStatus(application.id, status)}
        />
        {error && <span className="status-error">Couldn&rsquo;t save</span>}
      </td>
    </tr>
  )
}
