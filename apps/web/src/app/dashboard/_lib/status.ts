import type { StatusKey } from './types'

// The Worker's application_status enum ('interviewing', 'closed') and the
// dashboard's StatusKey pill classes ('interview', 'rejected') predate each
// other and don't line up. One mapping, shared by every view that renders a
// pill from Worker data. event_type ('interview', singular) is accepted too
// so Recent Activity can use the same table.

// Lower-case, for prose like "replied → interviewing".
export const STATUS_LABELS: Record<string, string> = {
  applied: 'applied',
  replied: 'replied',
  interview: 'interviewing',
  interviewing: 'interviewing',
  offer: 'offer',
  closed: 'closed',
}

// Capitalised, for a pill.
export const PILL_LABELS: Record<string, string> = {
  applied: 'Applied',
  replied: 'Replied',
  interview: 'Interview',
  interviewing: 'Interview',
  offer: 'Offer',
  closed: 'Closed',
}

// 'closed' has no dedicated .status.closed CSS class — it uses the existing
// 'rejected' pill styling. 'interviewing' collapses to 'interview'.
export function pillStatusFor(status: string): StatusKey {
  if (status === 'closed') return 'rejected'
  if (status === 'interviewing') return 'interview'
  return status as StatusKey
}
