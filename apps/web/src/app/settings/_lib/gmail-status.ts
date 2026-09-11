import { z } from 'zod'
import { env } from '../../../env'

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

export type GmailStatus = z.infer<typeof StatusSchema>

export async function fetchGmailStatus(
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
