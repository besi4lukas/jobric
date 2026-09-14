'use server'

import { auth } from '@clerk/nextjs/server'
import { fetchApplications } from '../_lib/fetch-applications'
import type { ApplicationsResponse } from '../_lib/applications-schema'

// "Load more" for Applications. A Server Action rather than a client-side
// fetch to the Worker: no CORS (techdebt #9), and the Clerk session token
// stays on the server. Returns null on any failure — the list keeps what it
// has and shows a retry line.
export async function loadApplicationsPage(
  cursor: string,
): Promise<ApplicationsResponse | null> {
  const { getToken } = await auth()
  return fetchApplications(getToken, cursor)
}
