'use client'

import { useState } from 'react'
import { COMPANIES } from '../../_data/companies'
import type { CompaniesTab } from '../../_lib/types'
import { CompanyCard } from './CompanyCard'

const TABS: { key: CompaniesTab; label: string }[] = [
  { key: 'all', label: 'All · 47' },
  { key: 'active', label: 'Active · 11' },
  { key: 'offers', label: 'Offers · 3' },
  { key: 'closed', label: 'Closed · 18' },
  { key: 'archived', label: 'Archived' },
]

export function CompaniesView() {
  const [tab, setTab] = useState<CompaniesTab>('all')

  return (
    <section className="view active">
      <div className="view-actions">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'active' : ''}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
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
