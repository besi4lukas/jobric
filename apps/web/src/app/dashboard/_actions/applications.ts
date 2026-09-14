'use server'

import { auth } from '@clerk/nextjs/server'
import { parseStatusInput } from '../_lib/applications-rows'
import {
  fetchApplications,
  updateApplicationStatus,
} from '../_lib/fetch-applications'
import type {
  ApplicationRow,
  ApplicationsResponse,
} from '../_lib/applications-schema'

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

// Status edit for the Applications tab (StatusSelect → ApplicationList).
// Pins the status server-side (see DESIGN.md §6) — the ingestion pipeline
// stops auto-updating this application until the user edits again. `status`
// arrives as a plain string off the <select>'s onChange; re-validate both
// arguments here since a Server Action is a public endpoint any POST can
// reach, not just the client this was built for. Returns null on bad input
// or any fetch/parse failure — ApplicationList rolls back its optimistic
// update either way.
export async function setApplicationStatus(
  id: string,
  status: string,
): Promise<ApplicationRow | null> {
  const parsedStatus = parseStatusInput(status)
  if (!parsedStatus || !id) return null

  const { getToken } = await auth()
  return updateApplicationStatus(getToken, id, parsedStatus)
}
