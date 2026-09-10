type Counts = {
  tracked: number
  open: number
  active: number
}

export function StatsGrid({ counts }: { counts: Counts }) {
  return (
    <div className="grid-stats">
      <StatCard label="Tracked" value={counts.tracked} unit="apps" />
      <StatCard label="Still open" value={counts.open} />
      <StatCard label="Interviewing or better" value={counts.active} />
    </div>
  )
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string
  value: number
  unit?: string
}) {
  return (
    <div className="stat">
      <div className="l">{label}</div>
      <div className="n">
        {value}
        {unit && <span className="u">{unit}</span>}
      </div>
    </div>
  )
}
