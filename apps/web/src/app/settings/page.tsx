import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { env } from '../../env'

const StatusSchema = z.discriminatedUnion('connected', [
  z.object({ connected: z.literal(true), email: z.string().email() }),
  z.object({ connected: z.literal(false) }),
])
type GmailStatus = z.infer<typeof StatusSchema>

const REASON_MESSAGES: Record<string, string> = {
  state_mismatch: "Couldn't verify the OAuth state. Please try again.",
  missing_params: 'Google did not return the expected parameters.',
  token_exchange_failed:
    'Google rejected the authorization code. Please try again.',
  userinfo_failed: "Couldn't read your Google account email.",
  email_in_use: 'That Gmail address is already linked to another account.',
  upsert_failed: "Couldn't save the connection. Please try again.",
  no_session_token: 'Your session expired. Please sign in again.',
  access_denied: 'You declined to share access.',
}

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const { userId, getToken } = await auth()
  if (!userId) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>Please sign in.</p>
      </main>
    )
  }

  const params = await searchParams
  const flashStatus = pickString(params.status)
  const flashEmail = pickString(params.email)
  const flashReason = pickString(params.reason)

  const status = await fetchGmailStatus(getToken)

  return (
    <main
      style={{
        padding: '2.5rem',
        maxWidth: '640px',
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header style={{ marginBottom: '2rem' }}>
        <Link href="/dashboard" style={{ color: '#666', fontSize: '0.9rem' }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ marginTop: '0.5rem' }}>Settings</h1>
      </header>

      <section
        style={{
          border: '1px solid #e5e5e5',
          borderRadius: '8px',
          padding: '1.5rem',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Gmail</h2>
        <p style={{ color: '#555' }}>
          Jobric reads job-related email from your inbox to track applications.
          Read-only access. We never send, modify, or delete email.
        </p>

        <ConnectionStatus status={status} />

        {flashStatus === 'connected' && flashEmail && (
          <p
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#ecfdf5',
              color: '#065f46',
              borderRadius: '6px',
            }}
          >
            Connected {flashEmail}.
          </p>
        )}
        {flashStatus === 'error' && (
          <p
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#fef2f2',
              color: '#991b1b',
              borderRadius: '6px',
            }}
          >
            {(flashReason && REASON_MESSAGES[flashReason]) ??
              'Something went wrong connecting Gmail.'}
          </p>
        )}

        <div style={{ marginTop: '1.5rem' }}>
          <a
            href="/api/gmail/connect"
            style={{
              display: 'inline-block',
              padding: '0.6rem 1rem',
              background: '#111',
              color: '#fff',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            {status?.connected ? 'Reconnect Gmail' : 'Connect Gmail'}
          </a>
        </div>
      </section>
    </main>
  )
}

function ConnectionStatus({ status }: { status: GmailStatus | null }) {
  if (status === null) {
    return <p style={{ color: '#888' }}>Could not load connection status.</p>
  }
  if (status.connected) {
    return (
      <p style={{ marginTop: '1rem' }}>
        <strong>Connected:</strong> {status.email}
      </p>
    )
  }
  return (
    <p style={{ marginTop: '1rem', color: '#666' }}>
      No Gmail account connected yet.
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

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}
