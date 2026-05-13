import { STATS } from '../../_data/overview'
import type { Stat } from '../../_lib/types'

export function StatsGrid() {
  return (
    <div className="grid-stats">
      {STATS.map((s) => (
        <StatCard key={s.label} stat={s} />
      ))}
    </div>
  )
}

function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className="stat">
      <div className="l">{stat.label}</div>
      <div className="n">
        {stat.value}
        {stat.unit && <span className="u">{stat.unit}</span>}
      </div>
      {stat.trend && <div className="t">{stat.trend}</div>}
    </div>
  )
}
