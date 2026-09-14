// Applications tab layout preference, persisted client-side only
// (localStorage key below) — the page is SSR'd server-side without it, so
// the default here must match the server-rendered default ('table') or the
// client would hydrate-mismatch on first paint.
export type ViewMode = 'table' | 'grid'

export const VIEW_MODE_STORAGE_KEY = 'jobric.applications.view'

export function parseViewMode(raw: unknown): ViewMode {
  return raw === 'grid' ? 'grid' : 'table'
}
