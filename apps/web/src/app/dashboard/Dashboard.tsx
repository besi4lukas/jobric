'use client'

import { useState } from 'react'
import type { InboxResponse } from './_lib/inbox-schema'
import type { OverviewResponse } from './_lib/overview-schema'
import { CompaniesView } from './_components/companies/CompaniesView'
import { InboxView } from './_components/inbox/InboxView'
import { OverviewView } from './_components/overview/OverviewView'
import { Sidebar } from './_components/Sidebar'
import { Topbar } from './_components/Topbar'
import { TITLES } from './_data/titles'
import type { ViewKey } from './_lib/types'
import './dashboard.css'

type DashboardProps = {
  userName: string
  userEmail: string
  userInitial: string
  overview: OverviewResponse | null
  inbox: InboxResponse | null
}

export function Dashboard({
  userName,
  userEmail,
  userInitial,
  overview,
  inbox,
}: DashboardProps) {
  const [view, setView] = useState<ViewKey>('overview')
  const title = TITLES[view]

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
          <Topbar title={title.h} subtitle={title.s} />
          <div className="content">
            {view === 'overview' && <OverviewView overview={overview} />}
            {view === 'inbox' && (
              <InboxView
                inbox={inbox}
                connected={overview?.account.connected ?? null}
              />
            )}
            {view === 'applications' && <CompaniesView />}
          </div>
        </main>
      </div>
    </div>
  )
}
