type BreakdownRow = { status: string; n: number }

const STATUS_LABELS: Record<string, string> = {
  applied: 'Applied',
  replied: 'Replied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  closed: 'Closed',
}

// Current position in the funnel, not conversion — widths are computed from
// the live counts, not hand-authored.
export function StatusBreakdownCard({
  breakdown,
}: {
  breakdown: BreakdownRow[]
}) {
  const max = Math.max(1, ...breakdown.map((row) => row.n))

  return (
    <div className="card funnel">
      <div className="card-head">
        <h3>Where things stand</h3>
      </div>
      {breakdown.map((row) => (
        <div key={row.status} className="bar-row">
          <span>{STATUS_LABELS[row.status] ?? row.status}</span>
          <div className="bar">
            <div style={{ width: `${(row.n / max) * 100}%` }} />
          </div>
          <span className="num">{row.n}</span>
        </div>
      ))}
    </div>
  )
}
