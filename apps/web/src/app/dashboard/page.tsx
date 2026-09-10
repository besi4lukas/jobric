import { currentUser, auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { env } from '../../env'
import { Dashboard } from './Dashboard'

const ApplicationStatusSchema = z.enum([
  'applied',
  'replied',
  'interviewing',
  'offer',
  'closed',
])

// `summary` is `.optional()` with a default here (web side) but required on
// the Worker side (apps/agents/src/routes/overview.ts) — deliberately
// asymmetric, do not "fix" this by making them match. Zod strips unknown
// keys, so if the web app is deployed ahead of the Worker (or against an
// older Worker mid-rollout that doesn't send `summary` at all), a required
// field here would throw a ZodError and blank the whole Overview page.
// Defaulting to 'unavailable' lets everything else on the page still
// render. See routes/overview.ts for the other half of this comment.
const OverviewResponseSchema = z.object({
  account: z.object({
    connected: z.boolean(),
    email: z.string().email().optional(),
    connectedAt: z.string().optional(),
    lastSyncedAt: z.string().nullable().optional(),
  }),
  counts: z.object({
    tracked: z.number().int().nonnegative(),
    open: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
  }),
  breakdown: z.array(
    z.object({
      status: ApplicationStatusSchema,
      n: z.number().int().nonnegative(),
    }),
  ),
  recent: z.array(
    z.object({
      id: z.string(),
      company: z.string(),
      role: z.string(),
      eventType: z.enum(['applied', 'replied', 'interview', 'offer', 'closed']),
      previousStatus: ApplicationStatusSchema.nullable(),
      reason: z.string().nullable(),
      occurredAt: z.string(),
    }),
  ),
  summary: z
    .object({
      state: z.enum(['ready', 'pending', 'unavailable']),
      headline: z.string().nullable(),
      body: z.string().nullable(),
      generatedAt: z.string().nullable(),
    })
    .optional()
    .default({
      state: 'unavailable',
      headline: null,
      body: null,
      generatedAt: null,
    }),
})

export type OverviewResponse = z.infer<typeof OverviewResponseSchema>

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

async function fetchOverview(
  getToken: () => Promise<string | null>,
): Promise<OverviewResponse | null> {
  const sessionJwt = await getToken()
  if (!sessionJwt) return null

  try {
    const response = await fetch(`${env.NEXT_PUBLIC_AGENTS_URL}/api/overview`, {
      headers: { authorization: `Bearer ${sessionJwt}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    return OverviewResponseSchema.parse(await response.json())
  } catch (err) {
    // Previously a silent `catch {}` — schema drift (e.g. a ZodError from
    // the Worker's response shape changing) rendered as "Couldn't load your
    // overview" with zero diagnostics. This is a server component; it logs
    // to the Next.js server console, never the browser.
    console.error('overview fetch/parse failed', err)
    return null
  }
}
