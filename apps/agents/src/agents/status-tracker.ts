import { Agent } from 'agents'
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { StatusChangeSchema, type Env, type ParsedApplication } from '../types'

// ─── StatusTrackerAgent ────────────────────────────────────────────────────────
// Responsibility: Given a newly parsed application and the previous known state,
// determine if the status changed and why.
//
// Owns the application status history in its SQLite.
// ──────────────────────────────────────────────────────────────────────────────
export class StatusTrackerAgent extends Agent<Env> {
  async onRequest(req: Request): Promise<Response> {
    const incoming = await req.json<ParsedApplication>()

    // Look up last known status for this company + role from SQLite
    const existing = this.sql<{ status: string; application_id: string }>`
      SELECT status, application_id
      FROM applications
      WHERE company = ${incoming.company} AND role = ${incoming.role}
      ORDER BY updated_at DESC
      LIMIT 1
    `

    const previousStatus = existing[0]?.status ?? 'unknown'
    const applicationId = existing[0]?.application_id ?? crypto.randomUUID()

    // ── LLM Call: did the status actually change? ───────────────────────────
    // We use Claude to reason about this because status transitions can be
    // ambiguous — e.g. a "phone screen scheduled" email is still "interview",
    // but a "next steps" email after an offer means the status hasn't changed.
    const { object: statusChange } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: StatusChangeSchema,
      system: `
        You are tracking job application status changes.
        Be precise: only mark changed=true if the status genuinely progressed.
        Provide a clear reason explaining your decision.
      `,
      prompt: `
        Application: ${incoming.company} — ${incoming.role}
        Previous status: ${previousStatus}
        New parsed status: ${incoming.status}
        Next steps from email: ${incoming.nextSteps ?? 'none'}

        Did the status change? If so, why?
      `,
    })

    // Upsert the application record
    this.sql`
      INSERT INTO applications (application_id, company, role, status, updated_at)
      VALUES (${applicationId}, ${incoming.company}, ${incoming.role}, ${incoming.status}, ${new Date().toISOString()})
      ON CONFLICT (company, role)
      DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
    `

    // Log the status change event if it changed
    if (statusChange.changed) {
      this.sql`
        INSERT INTO status_history (application_id, from_status, to_status, reason, changed_at)
        VALUES (
          ${applicationId},
          ${statusChange.previousStatus},
          ${statusChange.newStatus},
          ${statusChange.reason},
          ${new Date().toISOString()}
        )
      `
    }

    return Response.json({ ...statusChange, applicationId })
  }
}
