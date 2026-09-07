import Link from 'next/link'
import type { OverviewResponse } from '../../page'
import { RecentActivityCard } from './RecentActivityCard'
import { StatsGrid } from './StatsGrid'
import { StatusBreakdownCard } from './StatusBreakdownCard'
import { SummaryCard } from './SummaryCard'

export function OverviewView({
  overview,
}: {
  overview: OverviewResponse | null
}) {
  // Fetch failed — an error, not an empty search.
  if (!overview) {
    return (
      <section className="view active">
        <div className="card">
          <p className="empty-hint">Couldn&rsquo;t load your overview.</p>
        </div>
      </section>
    )
  }

  const { account, counts, breakdown, recent, summary } = overview

  // Gmail not connected — prompt to /settings, distinct from "connected with
  // zero applications" below.
  if (!account.connected) {
    return (
      <section className="view active">
        <div className="card">
          <h3>Connect Gmail to get started</h3>
          <p className="empty-hint">
            Jobric reads job-related email from your inbox to track
            applications.{' '}
            <Link href="/settings" style={{ color: 'var(--accent)' }}>
              Connect Gmail
            </Link>{' '}
            to begin.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="view active">
      {counts.tracked === 0 ? (
        <div className="card">
          <p className="empty-hint">
            <strong>Nothing yet.</strong> Jobric only reads mail that arrives
            after you connected, so there&rsquo;s nothing to show until your
            next application email lands. We check every few minutes.
          </p>
        </div>
      ) : (
        <>
          <StatsGrid counts={counts} />
          <div className="overview-grid">
            <StatusBreakdownCard breakdown={breakdown} />
            <SummaryCard summary={summary} />
          </div>
          <RecentActivityCard recent={recent} />
        </>
      )}
    </section>
  )
}
