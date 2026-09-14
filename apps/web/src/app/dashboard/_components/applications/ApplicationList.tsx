'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  loadApplicationsPage,
  setApplicationStatus,
} from '../../_actions/applications'
import {
  applyOptimisticStatus,
  replaceRow,
  restoreRow,
} from '../../_lib/applications-rows'
import type {
  ApplicationRow,
  ApplicationsResponse,
  ApplicationStatus,
} from '../../_lib/applications-schema'
import {
  VIEW_MODE_STORAGE_KEY,
  parseViewMode,
  type ViewMode,
} from '../../_lib/view-mode'
import { ApplicationCard } from './ApplicationCard'
import { ApplicationsTable } from './ApplicationsTable'
import { ViewToggle } from './ViewToggle'

// First page arrives from the server (page.tsx → Dashboard → ApplicationsView);
// later pages append via the loadApplicationsPage server action. The
// Worker's cursor is keyset on (lastActivityAt, id), so appending is safe
// even when new activity has landed at the top since the first page —
// nothing repeats.
export function ApplicationList({
  initial,
}: {
  initial: ApplicationsResponse
}) {
  const [rows, setRows] = useState<ApplicationRow[]>(initial.applications)
  const [nextCursor, setNextCursor] = useState<string | null>(
    initial.nextCursor,
  )
  const [failed, setFailed] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Separate from the "Load more" transition above so an in-flight status
  // edit never disables or re-labels the "Load more" button (and vice
  // versa) — they share nothing but `rows`.
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const [, startStatusTransition] = useTransition()

  // Table is the server-rendered default (page.tsx has no localStorage
  // access), so reading the stored preference happens post-mount to avoid a
  // hydration mismatch.
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  useEffect(() => {
    try {
      setViewMode(parseViewMode(localStorage.getItem(VIEW_MODE_STORAGE_KEY)))
    } catch {
      // Private browsing / blocked storage — stay on the default.
    }
  }, [])

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
    } catch {
      // Private browsing / blocked storage — the choice just won't persist.
    }
  }

  function loadMore() {
    if (!nextCursor) return
    const cursor = nextCursor
    setFailed(false)
    startTransition(async () => {
      const page = await loadApplicationsPage(cursor)
      if (!page) {
        setFailed(true)
        return
      }
      setRows((current) => [...current, ...page.applications])
      setNextCursor(page.nextCursor)
    })
  }

  // StatusSelect (table Actions column + card .actions row) calls this.
  // Optimistic, with rollback — and deliberately never re-sorts `rows`:
  // doing so would move the edited row out from under the pointer, and its
  // freshly-bumped lastActivityAt could exceed every cursor "Load more" has
  // already handed out, so a row that round-tripped to the top couldn't be
  // re-served if it had instead been removed and reinserted there.
  function changeStatus(id: string, status: ApplicationStatus) {
    const snapshot = rows.find((row) => row.id === id)
    if (!snapshot) return

    setErrorId(null)
    setRows((current) => applyOptimisticStatus(current, id, status))
    setPendingId(id)

    startStatusTransition(async () => {
      const updated = await setApplicationStatus(id, status)
      setPendingId(null)
      if (updated) {
        setRows((current) => replaceRow(current, updated))
      } else {
        setRows((current) => restoreRow(current, snapshot))
        setErrorId(id)
      }
    })
  }

  return (
    <div>
      <div className="view-actions">
        <span className="meta">sorted by last activity</span>
        <ViewToggle mode={viewMode} onChange={changeViewMode} />
      </div>

      {viewMode === 'table' ? (
        <ApplicationsTable
          applications={rows}
          pendingId={pendingId}
          errorId={errorId}
          onChangeStatus={changeStatus}
        />
      ) : (
        <div className="applications-grid">
          {rows.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              pending={pendingId === application.id}
              error={errorId === application.id}
              onChangeStatus={changeStatus}
            />
          ))}
        </div>
      )}

      {nextCursor && (
        <div className="load-more">
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? 'Loading…' : 'Load more'}
          </button>
          {failed && (
            <span className="load-more-error" role="status">
              Couldn&rsquo;t load more. Try again.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
