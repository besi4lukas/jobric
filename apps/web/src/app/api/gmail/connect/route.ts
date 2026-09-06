import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { env } from '../../../../env'

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

const OAUTH_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata',
]

const STATE_COOKIE_NAME = 'gmail_oauth_state'
const STATE_COOKIE_MAX_AGE_SECONDS = 600 // 10 min — covers the consent screen

export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const stateToken = randomState()

  const authorizeUrl = new URL(GOOGLE_AUTHORIZE_URL)
  authorizeUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
  authorizeUrl.searchParams.set('redirect_uri', env.GOOGLE_OAUTH_REDIRECT_URI)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('scope', OAUTH_SCOPES.join(' '))
  authorizeUrl.searchParams.set('access_type', 'offline')
  authorizeUrl.searchParams.set('prompt', 'consent')
  authorizeUrl.searchParams.set('include_granted_scopes', 'true')
  authorizeUrl.searchParams.set('state', stateToken)

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set({
    name: STATE_COOKIE_NAME,
    value: stateToken,
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
  })
  return response
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
