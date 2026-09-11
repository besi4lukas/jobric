import { env } from '../../../env'
import {
  OverviewResponseSchema,
  type OverviewResponse,
} from './overview-schema'

export async function fetchOverview(
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
