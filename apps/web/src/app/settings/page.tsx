import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { GmailCard } from './_components/GmailCard'
import { SettingsFooter } from './_components/SettingsFooter'
import { readFlashMessage } from './_lib/flash'
import { fetchGmailStatus } from './_lib/gmail-status'
import './settings.css'

export default async function SettingsPage() {
  const { userId, getToken } = await auth()
  if (!userId) {
    return (
      <div className="settings-page">
        <div className="settings-wrap">
          <p>Please sign in.</p>
        </div>
      </div>
    )
  }

  // Independent: one hits the Worker, the other reads a cookie.
  const [status, flashMessage] = await Promise.all([
    fetchGmailStatus(getToken),
    readFlashMessage(),
  ])

  return (
    <div className="settings-page">
      <main className="settings-wrap">
        <header className="settings-head">
          <Link href="/dashboard" className="back-link">
            <span aria-hidden="true">←</span>
            <span>Back to dashboard</span>
          </Link>
          <h1>Settings</h1>
        </header>

        <GmailCard status={status} flashMessage={flashMessage} />

        <SettingsFooter />
      </main>
    </div>
  )
}
