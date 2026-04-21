import { routeAgentRequest } from 'agents'
import { verifyToken } from '@clerk/backend'
import type { Env } from './types'
import type {
  ExportedHandler,
  ForwardableEmailMessage,
} from '@cloudflare/workers-types'

// Re-export all agent classes so Cloudflare can register the Durable Objects
export { OrchestratorAgent } from './agents/orchestrator'
export { EmailWatcherAgent } from './agents/email-watcher'
export { ParserAgent } from './agents/parser'
export { StatusTrackerAgent } from './agents/status-tracker'

// ─── Worker Entry Point ────────────────────────────────────────────────────────
export default {
  async fetch(req, env): Promise<Response> {
    // ── CORS preflight ──────────────────────────────────────────────────────
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      })
    }

    // ── JWT Validation (Clerk) ──────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return new Response('Unauthorized', { status: 401 })
    }

    let userId: string
    try {
      const payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      })
      if (!payload?.sub) {
        return new Response('Unauthorized', { status: 401 })
      }
      userId = payload.sub
    } catch {
      return new Response('Unauthorized', { status: 401 })
    }

    // Route to the correct agent, forwarding the verified userId as props
    const agentResponse = await routeAgentRequest(req, env, {
      props: { userId },
    })
    if (agentResponse) return agentResponse

    // Fallback for unmatched routes
    return new Response('Jobric Agents — route not found', { status: 404 })
  },

  // Handle incoming emails via Cloudflare Email Workers
  // Cloudflare delivers emails directly to this handler — no JWT needed
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const id = env.EmailWatcherAgent.idFromName('watcher')
    const stub = env.EmailWatcherAgent.get(id)

    // Forward the email to the EmailWatcherAgent Durable Object
    await stub.fetch('https://internal/email', {
      method: 'POST',
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        subject: message.headers.get('subject') ?? '',
        rawSize: message.rawSize,
      }),
    })
  },
} satisfies ExportedHandler<Env>
