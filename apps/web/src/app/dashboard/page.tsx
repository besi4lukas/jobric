import { currentUser, auth } from '@clerk/nextjs/server'
import { Dashboard } from './Dashboard'
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

  const overview = await fetchOverview(getToken)

  return (
    <Dashboard
      userName={userName}
      userEmail={userEmail}
      userInitial={userInitial}
      overview={overview}
    />
  )
}
