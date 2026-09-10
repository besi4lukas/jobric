type Counts = {
  tracked: number
  open: number
  active: number
}

export function StatsGrid({ counts }: { counts: Counts }) {
  return (
    <div className="grid-stats">
      <StatCard label="Applications" value={counts.tracked} />
      <StatCard label="Open applications" value={counts.open} />
      <StatCard label="Interviewing or better" value={counts.active} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="l">{label}</div>
      <div className="n">{value}</div>
    </div>
  )
}
