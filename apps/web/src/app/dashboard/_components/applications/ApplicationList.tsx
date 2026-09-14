'use client'

import { useEffect, useState, useTransition } from 'react'
import { loadApplicationsPage } from '../../_actions/applications'
import type {
  ApplicationRow,
  ApplicationsResponse,
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

  return (
    <div>
      <div className="view-actions">
        <span className="meta">sorted by last activity</span>
        <ViewToggle mode={viewMode} onChange={changeViewMode} />
      </div>

      {viewMode === 'table' ? (
        <ApplicationsTable applications={rows} />
      ) : (
        <div className="applications-grid">
          {rows.map((application) => (
            <ApplicationCard key={application.id} application={application} />
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
