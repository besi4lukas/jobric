import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { env } from '../../../../env'
import { encrypt } from '../../../../lib/crypto'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const GMAIL_PROFILE_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/profile'

const STATE_COOKIE_NAME = 'gmail_oauth_state'
const FLASH_COOKIE_NAME = 'gmail_oauth_flash'
// Short-lived: covers the one redirect render. Self-expires so a stale flash
// can't follow the user across navigations.
const FLASH_COOKIE_MAX_AGE_SECONDS = 30
const SETTINGS_PATH = '/settings'

// Only user-actionable errors get a specific code. Everything else collapses
// to 'generic' on the page; details stay in console logs for the dev.
type FlashReason = 'access_denied' | 'email_in_use' | 'generic'

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.string(),
  token_type: z.literal('Bearer'),
  id_token: z.string().optional(),
})

const UserInfoSchema = z.object({
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  sub: z.string().min(1),
})

// Anchors forward-only ingestion. We capture the user's CURRENT historyId at
// connect time and store it as last_history_id; the cron uses this as the
// startHistoryId for users.history.list, so no email older than this moment
// is ever ingested.
const ProfileSchema = z.object({
  emailAddress: z.string().email(),
  historyId: z.string().min(1),
})

export async function GET(request: NextRequest): Promise<Response> {
  const { userId, getToken } = await auth()
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateFromQuery = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    if (oauthError === 'access_denied') {
      return redirectToSettings(request, 'access_denied')
    }
    console.warn('gmail oauth: provider returned error', { oauthError })
    return redirectToSettings(request, 'generic')
  }

  const stateFromCookie = request.cookies.get(STATE_COOKIE_NAME)?.value
  if (!code || !stateFromQuery || !stateFromCookie) {
    console.warn('gmail oauth: missing callback params', {
      hasCode: Boolean(code),
      hasStateQuery: Boolean(stateFromQuery),
      hasStateCookie: Boolean(stateFromCookie),
    })
    return redirectToSettings(request, 'generic')
  }
  if (!constantTimeEqual(stateFromQuery, stateFromCookie)) {
    console.warn('gmail oauth: state mismatch')
    return redirectToSettings(request, 'generic')
  }

  // ── Exchange the authorization code for tokens ──────────────────────────
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResponse.ok) {
    console.warn('gmail oauth: token exchange failed', {
      status: tokenResponse.status,
    })
    return redirectToSettings(request, 'generic')
  }

  const tokens = TokenResponseSchema.parse(await tokenResponse.json())

  // ── Resolve the connected Google email address ──────────────────────────
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  })
  if (!userInfoResponse.ok) {
    console.warn('gmail oauth: userinfo fetch failed', {
      status: userInfoResponse.status,
    })
    return redirectToSettings(request, 'generic')
  }
  const userInfo = UserInfoSchema.parse(await userInfoResponse.json())

  // ── Anchor forward-only ingestion: capture current historyId ────────────
  const profileResponse = await fetch(GMAIL_PROFILE_URL, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  })
  if (!profileResponse.ok) {
    console.warn('gmail oauth: profile fetch failed', {
      status: profileResponse.status,
    })
    return redirectToSettings(request, 'generic')
  }
  const profile = ProfileSchema.parse(await profileResponse.json())

  // ── Encrypt the long-lived refresh_token before sending to the worker ───
  const encryptedRefreshToken = await encrypt(tokens.refresh_token)

  // ── Forward the upsert to the agents Worker (D1 lives there) ────────────
  const sessionJwt = await getToken()
  if (!sessionJwt) {
    console.warn('gmail oauth: no Clerk session token available')
    return redirectToSettings(request, 'generic')
  }

  const upsertResponse = await fetch(
    `${env.NEXT_PUBLIC_AGENTS_URL}/api/email-accounts`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sessionJwt}`,
      },
      body: JSON.stringify({
        email: userInfo.email,
        encryptedRefreshToken,
        lastHistoryId: profile.historyId,
      }),
    },
  )

  if (!upsertResponse.ok) {
    console.warn('gmail oauth: email_accounts upsert failed', {
      status: upsertResponse.status,
    })
    const reason: FlashReason =
      upsertResponse.status === 409 ? 'email_in_use' : 'generic'
    return redirectToSettings(request, reason)
  }

  const response = redirectToSettings(request)
  // Clear the one-shot state cookie
  response.cookies.set({
    name: STATE_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}

function redirectToSettings(
  request: NextRequest,
  flash?: FlashReason,
): NextResponse {
  const response = NextResponse.redirect(new URL(SETTINGS_PATH, request.url))
  // Always set/clear the flash cookie. On success (no flash arg) we explicitly
  // clear it so a stale error from a prior failed attempt doesn't leak through.
  response.cookies.set({
    name: FLASH_COOKIE_NAME,
    value: flash ?? '',
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: flash ? FLASH_COOKIE_MAX_AGE_SECONDS : 0,
  })
  return response
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
