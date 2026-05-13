import { Agent } from 'agents'
import {
  EmailEnvelopeSchema,
  assertUserId,
  type Env,
  type EmailEnvelope,
} from '../types'

// ─── EmailWatcherAgent ─────────────────────────────────────────────────────────
// Responsibility: Receive incoming emails, decide if they are job-related,
// and hand off to the OrchestratorAgent.
//
// This agent has ONE singleton instance ("watcher") — it's the inbox listener.
// ──────────────────────────────────────────────────────────────────────────────
export class EmailWatcherAgent extends Agent<Env> {
  // Called by the Worker email handler when a new email arrives
  async onRequest(req: Request): Promise<Response> {
    const envelope = EmailEnvelopeSchema.parse(await req.json())
    assertUserId(envelope.userId)

    // Quick subject-line filter before paying for an LLM call
    const isJobRelated = this.isLikelyJobEmail(envelope.subject, envelope.from)

    if (!isJobRelated) {
      return new Response('ignored — not job related', { status: 200 })
    }

    // Hand off to OrchestratorAgent — forward full envelope (userId included)
    const orchId = this.env.OrchestratorAgent.idFromName('main')
    const orchStub = this.env.OrchestratorAgent.get(orchId)

    const orchResponse = await orchStub.fetch(
      'https://internal/process-email',
      {
        method: 'POST',
        body: JSON.stringify(envelope satisfies EmailEnvelope),
      },
    )

    // Propagate non-2xx so the cron pins its watermark and retries next cycle.
    // Successful pipeline runs AND captured parse_failures both return 2xx.
    if (!orchResponse.ok) {
      return new Response('orchestrator pipeline failed', {
        status: orchResponse.status,
      })
    }
    return new Response('handed off to orchestrator', { status: 200 })
  }

  // Simple keyword filter to avoid LLM calls on irrelevant emails
  private isLikelyJobEmail(subject: string, from: string): boolean {
    const keywords = [
      'application',
      'interview',
      'offer',
      'rejection',
      'position',
      'role',
      'opportunity',
      'recruiter',
      'hiring',
      'job',
      'career',
      'linkedin',
      'greenhouse',
      'lever',
      'workday',
      'jobvite',
      'ashby',
    ]

    const lower = `${subject} ${from}`.toLowerCase()
    return keywords.some((kw) => lower.includes(kw))
  }
}
