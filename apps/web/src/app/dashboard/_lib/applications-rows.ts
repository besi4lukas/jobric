import { ApplicationStatusSchema } from './overview-schema'
import type { ApplicationRow, ApplicationStatus } from './applications-schema'

// Pure row-list helpers for the status-edit optimistic-update dance in
// ApplicationList. Factored out so that dance is unit-testable without a
// DOM — this repo has no DOM environment configured for apps/web tests
// (CLAUDE.md).

// Optimistically applies a status edit by id, in place — never re-sorts.
// ApplicationList relies on that: re-sorting would move the row out from
// under the pointer mid-click, and the row's freshly-bumped
// `lastActivityAt` can exceed every cursor already handed out by "Load
// more", so a row that left its position couldn't be re-served if it came
// back at the top. No-op if `id` isn't present.
export function applyOptimisticStatus(
  rows: ApplicationRow[],
  id: string,
  status: ApplicationStatus,
): ApplicationRow[] {
  return rows.map((row) =>
    row.id === id ? { ...row, status, statusSource: 'user' } : row,
  )
}

// Swaps in the server's row after a successful PATCH, replacing by id so
// the row's position — and therefore the optimistic update above — is
// preserved. Picks up whatever the Worker actually persisted (in
// particular the fresh `lastActivityAt`).
export function replaceRow(
  rows: ApplicationRow[],
  updated: ApplicationRow,
): ApplicationRow[] {
  return rows.map((row) => (row.id === updated.id ? updated : row))
}

// Rolls an optimistic edit back to its pre-edit snapshot after a failed
// PATCH.
export function restoreRow(
  rows: ApplicationRow[],
  snapshot: ApplicationRow,
): ApplicationRow[] {
  return rows.map((row) => (row.id === snapshot.id ? snapshot : row))
}

// Server Actions are public endpoints reachable with any body, not just the
// StatusSelect that normally calls them — re-validate rather than trust the
// caller. Returns null for anything that isn't one of the five known
// statuses.
export function parseStatusInput(value: string): ApplicationStatus | null {
  const parsed = ApplicationStatusSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
