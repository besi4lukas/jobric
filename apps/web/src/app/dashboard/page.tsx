import { currentUser } from '@clerk/nextjs/server'
import { Dashboard } from './Dashboard'

export default async function DashboardPage() {
  const user = await currentUser()

  const firstName = user?.firstName ?? 'Mira'
  const lastName = user?.lastName ?? 'K.'
  const userName = `${firstName} ${lastName ? `${lastName[0]}.` : ''}`.trim()
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? 'mira@gmail.com'
  const userInitial = (firstName[0] ?? 'M').toUpperCase()

  return (
    <Dashboard
      userName={userName}
      userEmail={userEmail}
      userInitial={userInitial}
    />
  )
}
