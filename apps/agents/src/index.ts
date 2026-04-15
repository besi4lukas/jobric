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
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Missing or malformed Authorization header', {
        status: 401,
      })
    }

    const token = authHeader.slice(7)
    try {
      const payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      })

      // payload.sub is the Clerk userId
      if (!payload.sub) {
        return new Response('Invalid token', { status: 401 })
      }

      // Attach userId to the request headers so agents can access it
      const headers = new Headers(req.headers)
      headers.set('X-User-Id', payload.sub)
      const authedReq = new Request(req.url, {
        method: req.method,
        headers,
        body: req.body,
      })

      // ── API Routes ──────────────────────────────────────────────────────
      const url = new URL(req.url)
      if (url.pathname === '/api/applications' && req.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM applications WHERE user_id = ? ORDER BY processed_at DESC',
        )
          .bind(payload.sub)
          .all()
        return Response.json(results)
      }

      // Route to the correct agent based on URL
      const agentResponse = await routeAgentRequest(authedReq, env)
      if (agentResponse) return agentResponse

      // Fallback for unmatched routes
      return new Response('Jobric Agents — route not found', { status: 404 })
    } catch {
      return new Response('Invalid or expired token', { status: 401 })
    }
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
