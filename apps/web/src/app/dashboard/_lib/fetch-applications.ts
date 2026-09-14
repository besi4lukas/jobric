import { env } from '../../../env'
import {
  APPLICATIONS_PAGE_SIZE,
  ApplicationRowSchema,
  ApplicationsResponseSchema,
  type ApplicationRow,
  type ApplicationsResponse,
  type ApplicationStatus,
} from './applications-schema'

// Server-only: page.tsx for the first page, _actions/applications.ts for
// the rest. The browser never calls the Worker directly — Worker responses
// carry no CORS headers (techdebt #9), and keeping the Clerk token
// server-side is the right shape regardless.
export async function fetchApplications(
  getToken: () => Promise<string | null>,
  cursor: string | null = null,
): Promise<ApplicationsResponse | null> {
  const sessionJwt = await getToken()
  if (!sessionJwt) return null

  const url = new URL('/api/applications', env.NEXT_PUBLIC_AGENTS_URL)
  url.searchParams.set('limit', String(APPLICATIONS_PAGE_SIZE))
  if (cursor) url.searchParams.set('cursor', cursor)

  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${sessionJwt}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    return ApplicationsResponseSchema.parse(await response.json())
  } catch (err) {
    // Server component / server action — logs to the Next.js server console,
    // never the browser. See fetch-overview.ts for why this isn't silent.
    console.error('applications fetch/parse failed', err)
    return null
  }
}

// Status edit (StatusSelect → ApplicationList, via the setApplicationStatus
// Server Action). A manual edit pins the status server-side — see
// DESIGN.md §6 — so the ingestion pipeline stops overwriting it until the
// user edits again. Same error posture as fetchApplications: null on any
// non-2xx, network failure, or a response that doesn't parse.
export async function updateApplicationStatus(
  getToken: () => Promise<string | null>,
  id: string,
  status: ApplicationStatus,
): Promise<ApplicationRow | null> {
  const sessionJwt = await getToken()
  if (!sessionJwt) return null

  const url = new URL(
    `/api/applications/${encodeURIComponent(id)}/status`,
    env.NEXT_PUBLIC_AGENTS_URL,
  )

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${sessionJwt}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status }),
      cache: 'no-store',
    })
    if (!response.ok) return null
    return ApplicationRowSchema.parse(await response.json())
  } catch (err) {
    console.error('application status update fetch/parse failed', err)
    return null
  }
}
