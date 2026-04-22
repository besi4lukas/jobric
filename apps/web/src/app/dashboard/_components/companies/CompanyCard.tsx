import type { Company } from '../../_lib/types'
import { Logo } from '../Logo'
import { StatusPill } from '../StatusPill'

export function CompanyCard({ company }: { company: Company }) {
  return (
    <button className="company-card">
      <div className="top">
        <Logo>{company.logo}</Logo>
        <div>
          <h4>{company.name}</h4>
          <div className="role">{company.role}</div>
        </div>
      </div>
      <div className="mid">
        <StatusPill status={company.status}>{company.statusLabel}</StatusPill>
        <span className="emails">{company.emails} emails</span>
      </div>
      <div className="last">
        <span>{company.last}</span>
        <span className="w">{company.when}</span>
      </div>
    </button>
  )
}
