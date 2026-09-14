'use client'

import type { ApplicationStatus } from '../../_lib/applications-schema'
import { PILL_LABELS } from '../../_lib/status'

// Funnel order — matches how a candidate actually progresses, and how
// PILL_LABELS/StatusPill present status everywhere else in the tab.
const STATUS_OPTIONS: ApplicationStatus[] = [
  'applied',
  'replied',
  'interviewing',
  'offer',
  'closed',
]

// A native <select>, not a hand-rolled dropdown: accessible and
// mobile-native for free, and this repo has no DOM test environment
// (CLAUDE.md) to cover a custom listbox's keyboard handling. See
// techdebt.md for the pill-styled upgrade path.
export function StatusSelect({
  status,
  company,
  role,
  pending,
  onChange,
}: {
  status: ApplicationStatus
  company: string
  role: string
  pending: boolean
  onChange: (status: ApplicationStatus) => void
}) {
  return (
    <select
      className="status-select"
      value={status}
      disabled={pending}
      aria-busy={pending}
      aria-label={`Change status for ${role} at ${company}`}
      onChange={(event) => onChange(event.target.value as ApplicationStatus)}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {PILL_LABELS[option]}
        </option>
      ))}
    </select>
  )
}
