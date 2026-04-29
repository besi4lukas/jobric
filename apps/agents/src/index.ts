import { routeAgentRequest } from 'agents'
import { verifyToken } from '@clerk/backend'
import type { Env, EmailEnvelope } from './types'
import { handleClerkWebhook } from './webhooks/clerk'
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
    const url = new URL(req.url)

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

    // ── Clerk webhook — verified via svix signature, not Bearer JWT ────────
    if (url.pathname === '/webhooks/clerk') {
      return handleClerkWebhook(req, env)
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

    // Forward the verified userId to the agent. Props are private in the
    // partyserver Server base class, so we attach the verified id as a header
    // — trusted because the Worker just authenticated the JWT.
    const authedReq = new Request(req)
    authedReq.headers.set('X-User-Id', userId)

    const agentResponse = await routeAgentRequest(authedReq, env, {
      props: { userId },
    })
    if (agentResponse) return agentResponse

    // Fallback for unmatched routes
    return new Response('Jobric Agents — route not found', { status: 404 })
  },

  // Handle incoming emails via Cloudflare Email Workers
  // Cloudflare delivers emails directly to this handler — no JWT needed
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    // Resolve userId from the destination address via D1.
    // Fail loud if unresolved — previously missing userId silently skipped D1 writes.
    const row = await env.DB.prepare(
      `SELECT user_id FROM email_accounts WHERE email = ? LIMIT 1`,
    )
      .bind(message.to)
      .first<{ user_id: string }>()

    const userId = row?.user_id
    if (!userId) {
      throw new Error(
        `email ingress: no email_accounts row for to=${message.to}`,
      )
    }

    const id = env.EmailWatcherAgent.idFromName('watcher')
    const stub = env.EmailWatcherAgent.get(id)

    const envelope: EmailEnvelope = {
      userId,
      from: message.from,
      to: message.to,
      subject: message.headers.get('subject') ?? '',
      rawSize: message.rawSize,
    }

    // Forward the email to the EmailWatcherAgent Durable Object
    await stub.fetch('https://internal/email', {
      method: 'POST',
      body: JSON.stringify(envelope),
    })
  },
} satisfies ExportedHandler<Env>
