import { COMPANIES } from '../../_data/companies'
import { CompanyCard } from './CompanyCard'

export function CompaniesView() {
  return (
    <section className="view active">
      <div className="view-actions">
        <span className="meta">sorted by last activity</span>
      </div>

      <div className="companies-grid">
        {COMPANIES.map((c) => (
          <CompanyCard key={c.name} company={c} />
        ))}
      </div>
    </section>
  )
}
