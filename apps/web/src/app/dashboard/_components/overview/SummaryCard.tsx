type Summary = {
  state: 'ready' | 'pending' | 'unavailable'
  headline: string | null
  body: string | null
  generatedAt: string | null
}

// Drops into the grid column UpcomingCard vacated (Upcoming interviews and
// stale applications didn't disappear as information — they became inputs
// to this prose instead of two lists on the page; see
// apps/agents/src/lib/overview-summary.ts).
export function SummaryCard({ summary }: { summary: Summary }) {
  return (
    <div className="card card-summary">
      <div className="card-head">
        <h3>The story so far</h3>
        <span className="meta">
          {summary.state === 'ready' && 'written by AI'}
          {summary.state === 'pending' && 'writing…'}
          {summary.state === 'unavailable' && '—'}
        </span>
      </div>
      {summary.state === 'ready' && summary.headline && summary.body ? (
        <>
          <p className="summary-headline">{summary.headline}</p>
          <p className="summary-body">{summary.body}</p>
        </>
      ) : summary.state === 'pending' ? (
        <p className="empty-hint">
          Your summary appears after Jobric next reads your mail.
        </p>
      ) : (
        <p className="empty-hint">
          Summary unavailable right now. The numbers above are up to date.
        </p>
      )}
    </div>
  )
}
