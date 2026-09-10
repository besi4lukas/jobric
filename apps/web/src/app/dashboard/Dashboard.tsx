'use client'

import { useState } from 'react'
import type { OverviewResponse } from './page'
import { CompaniesView } from './_components/companies/CompaniesView'
import { InboxView } from './_components/inbox/InboxView'
import { OverviewView } from './_components/overview/OverviewView'
import { Sidebar } from './_components/Sidebar'
import { Topbar } from './_components/Topbar'
import { TITLES } from './_data/titles'
import { formatShortDate, relativeTime } from './_lib/format'
import type { ViewKey } from './_lib/types'
import './dashboard.css'

type DashboardProps = {
  userName: string
  userEmail: string
  userInitial: string
  overview: OverviewResponse | null
}

export function Dashboard({
  userName,
  userEmail,
  userInitial,
  overview,
}: DashboardProps) {
  const [view, setView] = useState<ViewKey>('overview')
  const title = TITLES[view]

  // Topbar's "Watching …" freshness label — Overview only, and only once an
  // account is actually connected. Built here (not in Topbar, which stays
  // dumb) because Dashboard already holds both `view` and `overview`.
  const accountLabel =
    view === 'overview' && overview?.account.connected
      ? {
          email: overview.account.email ?? '',
          since: overview.account.connectedAt
            ? formatShortDate(overview.account.connectedAt)
            : null,
          checked: overview.account.lastSyncedAt
            ? relativeTime(overview.account.lastSyncedAt)
            : null,
        }
      : null

  return (
    <div className="dashboard-app">
      <div className="app">
        <Sidebar
          view={view}
          onChangeView={setView}
          userName={userName}
          userEmail={userEmail}
          userInitial={userInitial}
        />

        <main className="main">
          <Topbar
            title={title.h}
            subtitle={title.s}
            accountLabel={accountLabel}
          />
          <div className="content">
            {view === 'overview' && <OverviewView overview={overview} />}
            {view === 'inbox' && <InboxView />}
            {view === 'companies' && <CompaniesView />}
          </div>
        </main>
      </div>
    </div>
  )
}
