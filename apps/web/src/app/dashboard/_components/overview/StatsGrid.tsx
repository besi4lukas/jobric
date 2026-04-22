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
      <div className="t">{stat.trend}</div>
      <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke={stat.stroke}
          strokeWidth="1.5"
          points={stat.points}
        />
      </svg>
    </div>
  )
}
