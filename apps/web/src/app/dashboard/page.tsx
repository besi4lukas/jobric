import { currentUser, auth } from '@clerk/nextjs/server'
import { Dashboard } from './Dashboard'
import { fetchApplications } from './_lib/fetch-applications'
import { fetchInbox } from './_lib/fetch-inbox'
import { fetchOverview } from './_lib/fetch-overview'

export default async function DashboardPage() {
  const user = await currentUser()
  const { getToken } = await auth()

  const firstName = user?.firstName ?? null
  const lastName = user?.lastName ?? null
  const primaryEmail = user?.primaryEmailAddress?.emailAddress ?? null

  const userName =
    firstName || lastName
      ? `${firstName ?? ''} ${lastName ? `${lastName[0]}.` : ''}`.trim()
      : (primaryEmail ?? 'Your account')
  const userEmail = primaryEmail ?? ''
  const userInitial = (firstName?.[0] ?? primaryEmail?.[0] ?? '?').toUpperCase()

  // All three tabs' first pages, in parallel — the Dashboard switches tabs
  // with client state, not routes, so all three must be ready at render.
  const [overview, inbox, applications] = await Promise.all([
    fetchOverview(getToken),
    fetchInbox(getToken),
    fetchApplications(getToken),
  ])

  return (
    <Dashboard
      userName={userName}
      userEmail={userEmail}
      userInitial={userInitial}
      overview={overview}
      inbox={inbox}
      applications={applications}
    />
  )
}
