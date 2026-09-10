// Shared date/time formatting helpers for the dashboard. Previously
// duplicated byte-for-byte between OverviewView.tsx and
// RecentActivityCard.tsx:44.

export function relativeTime(iso: string): string | null {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / (60 * 1000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function formatShortDate(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
