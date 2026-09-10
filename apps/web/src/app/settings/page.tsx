import Link from 'next/link'
import { cookies } from 'next/headers'
import { auth } from '@clerk/nextjs/server'
import { SignOutButton } from '@clerk/nextjs'
import { z } from 'zod'
import { env } from '../../env'
import { formatShortDate, relativeTime } from '../dashboard/_lib/format'
import './settings.css'

const StatusSchema = z.discriminatedUnion('connected', [
  z.object({
    connected: z.literal(true),
    email: z.string().email(),
    // Optional so the page still renders against a Worker that predates
    // these fields — it just omits the "since / checked" detail.
    connectedAt: z.string().nullish(),
    lastSyncedAt: z.string().nullish(),
  }),
  z.object({ connected: z.literal(false) }),
])
type GmailStatus = z.infer<typeof StatusSchema>

const FLASH_COOKIE_NAME = 'gmail_oauth_flash'

const FLASH_MESSAGES: Record<string, string> = {
  access_denied:
    'You declined to share access. Connect Gmail to track your applications.',
  email_in_use:
    'That Gmail address is already linked to another Jobric account.',
  generic: "Couldn't connect Gmail. Please try again.",
}

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

  const status = await fetchGmailStatus(getToken)
  const flashMessage = await readFlashMessage()

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

        <section className="card">
          <WatchingLine status={status} />
          <h2>Gmail</h2>
          <p className="blurb">
            Jobric reads job-related email from your inbox to track
            applications. Read-only access. We never send, modify, or delete
            email.
          </p>

          <ConnectionStatus status={status} />

          {flashMessage && <p className="flash">{flashMessage}</p>}

          <div className="card-actions">
            <a href="/api/gmail/connect" className="btn btn-primary">
              {status?.connected ? 'Reconnect Gmail' : 'Connect Gmail'}
            </a>
          </div>
        </section>

        <footer className="settings-footer">
          <span className="note">
            Signing out leaves your Gmail connection in place.
          </span>
          <SignOutButton redirectUrl="/">
            <button type="button" className="btn btn-ghost">
              Sign out
            </button>
          </SignOutButton>
        </footer>
      </main>
    </div>
  )
}

// Moved here from the dashboard Topbar: the inbox-freshness line now lives
// with the Gmail connection it describes, rather than on the Overview header.
function WatchingLine({ status }: { status: GmailStatus | null }) {
  if (!status?.connected) return null

  const since = status.connectedAt ? formatShortDate(status.connectedAt) : null
  const checked = status.lastSyncedAt ? relativeTime(status.lastSyncedAt) : null

  return (
    <p className="watching">
      <span>
        Watching {status.email}
        {since && <> since {since}</>}
      </span>
      {checked && <span className="checked">checked {checked}</span>}
    </p>
  )
}

function ConnectionStatus({ status }: { status: GmailStatus | null }) {
  if (status === null) {
    return (
      <p className="status">
        <span className="dot" aria-hidden="true" />
        <span className="muted">Could not load connection status.</span>
      </p>
    )
  }
  if (status.connected) {
    return (
      <p className="status is-connected">
        <span className="dot" aria-hidden="true" />
        <span>Connected</span>
        <span className="addr">{status.email}</span>
      </p>
    )
  }
  return (
    <p className="status">
      <span className="dot" aria-hidden="true" />
      <span className="muted">No Gmail account connected yet.</span>
    </p>
  )
}

async function fetchGmailStatus(
  getToken: () => Promise<string | null>,
): Promise<GmailStatus | null> {
  const sessionJwt = await getToken()
  if (!sessionJwt) return null

  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_AGENTS_URL}/api/email-accounts/me`,
      {
        headers: { authorization: `Bearer ${sessionJwt}` },
        cache: 'no-store',
      },
    )
    if (!response.ok) return null
    return StatusSchema.parse(await response.json())
  } catch {
    return null
  }
}

async function readFlashMessage(): Promise<string | null> {
  const cookieStore = await cookies()
  const code = cookieStore.get(FLASH_COOKIE_NAME)?.value
  if (!code) return null
  return FLASH_MESSAGES[code] ?? FLASH_MESSAGES.generic!
}
