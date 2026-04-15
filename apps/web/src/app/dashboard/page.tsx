import { UserButton } from '@clerk/nextjs'

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1>Dashboard</h1>
        <UserButton />
      </div>
    </div>
  )
}
