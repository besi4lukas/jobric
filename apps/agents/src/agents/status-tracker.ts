import { Agent } from 'agents'
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import {
  StatusChangeSchema,
  TrackEnvelopeSchema,
  assertUserId,
  type Env,
} from '../types'

// ─── StatusTrackerAgent ────────────────────────────────────────────────────────
// Responsibility: Given a parsed application and the previous known status
// (provided by OrchestratorAgent), decide whether the status changed and why.
// Stateless — D1 is the store of record, owned by OrchestratorAgent.
// ──────────────────────────────────────────────────────────────────────────────
export class StatusTrackerAgent extends Agent<Env> {
  async onRequest(req: Request): Promise<Response> {
    const envelope = TrackEnvelopeSchema.parse(await req.json())
    assertUserId(envelope.userId)
    const { parsed, previousStatus } = envelope

    const { object: statusChange } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: StatusChangeSchema,
      system: `
        You are tracking job application status changes.
        Be precise: only mark changed=true if the status genuinely progressed.
        Provide a clear reason explaining your decision.
      `,
      prompt: `
        Application: ${parsed.company} — ${parsed.role}
        Previous status: ${previousStatus ?? 'none (no prior record)'}
        New parsed status: ${parsed.status}
        Next steps from email: ${parsed.nextSteps ?? 'none'}

        Did the status change? If so, why?
      `,
    })

    return Response.json(statusChange)
  }
}
