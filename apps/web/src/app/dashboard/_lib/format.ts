// Shared date/time formatting helpers for the dashboard. Previously
// duplicated byte-for-byte between OverviewView.tsx and
// RecentActivityCard.tsx:44.

export function relativeTime(
  iso: string,
  now: Date = new Date(),
): string | null {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const diffMs = now.getTime() - then
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

// Inbox row timestamp, Gmail-style: "12m ago" / "3h ago" inside a day, the
// weekday inside a week ("Sat"), else a short date ("Apr 18"). `now` is
// injectable for tests.
export function threadTime(iso: string, now: Date = new Date()): string | null {
  const date = new Date(iso)
  const then = date.getTime()
  if (Number.isNaN(then)) return null
  const hours = (now.getTime() - then) / (60 * 60 * 1000)
  if (hours < 24) return relativeTime(iso, now)
  if (hours < 7 * 24) {
    return date.toLocaleDateString(undefined, { weekday: 'short' })
  }
  return formatShortDate(iso)
}

// "1 email" / "5 emails" — the Applications card's singular/plural count.
export function emailCountLabel(n: number): string {
  return `${n} email${n === 1 ? '' : 's'}`
}
