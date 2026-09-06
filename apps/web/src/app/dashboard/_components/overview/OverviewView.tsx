import { FunnelCard } from './FunnelCard'
import { RecentActivityCard } from './RecentActivityCard'
import { StatsGrid } from './StatsGrid'
import { UpcomingCard } from './UpcomingCard'

export function OverviewView() {
  return (
    <section className="view active">
      <StatsGrid />
      <div className="overview-grid">
        <FunnelCard />
        <UpcomingCard />
      </div>
      <RecentActivityCard />
    </section>
  )
}
