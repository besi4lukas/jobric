'use server'

import { auth } from '@clerk/nextjs/server'
import { fetchInbox } from '../_lib/fetch-inbox'
import type { InboxResponse } from '../_lib/inbox-schema'

// "Load more" for the AI Inbox. A Server Action rather than a client-side
// fetch to the Worker: no CORS (techdebt #9), and the Clerk session token
// stays on the server. Returns null on any failure — the list keeps what it
// has and shows a retry line.
export async function loadInboxPage(
  cursor: string,
): Promise<InboxResponse | null> {
  const { getToken } = await auth()
  return fetchInbox(getToken, cursor)
}
