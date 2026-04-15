import { Agent } from 'agents'
import type { Env } from '../types'

// ─── EmailWatcherAgent ─────────────────────────────────────────────────────────
// Responsibility: Receive incoming emails, decide if they are job-related,
// and hand off to the OrchestratorAgent.
//
// This agent has ONE singleton instance ("watcher") — it's the inbox listener.
// ──────────────────────────────────────────────────────────────────────────────
export class EmailWatcherAgent extends Agent<Env> {
  // Called by the Worker email handler when a new email arrives
  async onRequest(req: Request): Promise<Response> {
    const email = await req.json<{
      from: string
      to: string
      subject: string
      rawSize: number
    }>()

    // Quick subject-line filter before paying for an LLM call
    const isJobRelated = this.isLikelyJobEmail(email.subject, email.from)

    if (!isJobRelated) {
      return new Response('ignored — not job related', { status: 200 })
    }

    // Log to this agent's built-in SQLite (survives restarts/deploys)
    this.sql`
      INSERT OR IGNORE INTO watched_emails (from_addr, subject, received_at)
      VALUES (${email.from}, ${email.subject}, ${new Date().toISOString()})
    `

    // Hand off to OrchestratorAgent
    const orchId = this.env.OrchestratorAgent.idFromName('main')
    const orchStub = this.env.OrchestratorAgent.get(orchId)

    await orchStub.fetch('https://internal/process-email', {
      method: 'POST',
      body: JSON.stringify(email),
    })

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
