import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { env } from '../../../../env'
import { encrypt } from '../../../../lib/crypto'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

const STATE_COOKIE_NAME = 'gmail_oauth_state'
const SETTINGS_PATH = '/settings'

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
    return redirectToSettings(request, {
      status: 'error',
      reason: oauthError,
    })
  }

  const stateFromCookie = request.cookies.get(STATE_COOKIE_NAME)?.value
  if (!code || !stateFromQuery || !stateFromCookie) {
    return redirectToSettings(request, {
      status: 'error',
      reason: 'missing_params',
    })
  }
  if (!constantTimeEqual(stateFromQuery, stateFromCookie)) {
    return redirectToSettings(request, {
      status: 'error',
      reason: 'state_mismatch',
    })
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
    return redirectToSettings(request, {
      status: 'error',
      reason: 'token_exchange_failed',
    })
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
    return redirectToSettings(request, {
      status: 'error',
      reason: 'userinfo_failed',
    })
  }
  const userInfo = UserInfoSchema.parse(await userInfoResponse.json())

  // ── Encrypt the long-lived refresh_token before sending to the worker ───
  const encryptedRefreshToken = await encrypt(tokens.refresh_token)

  // ── Forward the upsert to the agents Worker (D1 lives there) ────────────
  const sessionJwt = await getToken()
  if (!sessionJwt) {
    return redirectToSettings(request, {
      status: 'error',
      reason: 'no_session_token',
    })
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
      }),
    },
  )

  if (!upsertResponse.ok) {
    console.warn('gmail oauth: email_accounts upsert failed', {
      status: upsertResponse.status,
    })
    const reason =
      upsertResponse.status === 409 ? 'email_in_use' : 'upsert_failed'
    return redirectToSettings(request, { status: 'error', reason })
  }

  const response = redirectToSettings(request, {
    status: 'connected',
    email: userInfo.email,
  })
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
  params: Record<string, string>,
): NextResponse {
  const target = new URL(SETTINGS_PATH, request.url)
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value)
  }
  return NextResponse.redirect(target)
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
