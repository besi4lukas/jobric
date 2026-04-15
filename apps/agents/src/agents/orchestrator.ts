import { Agent } from 'agents'
import type { Env, ParsedApplication, StatusChange } from '../types'

// ─── OrchestratorAgent ─────────────────────────────────────────────────────────
// Responsibility: Coordinate the full pipeline.
// 1. Receives a job-related email from EmailWatcherAgent
// 2. Dispatches to ParserAgent → gets structured data
// 3. Dispatches to StatusTrackerAgent → determines if status changed
// 4. Stores the final result and notifies the frontend via state sync
//
// This agent has ONE singleton instance ("main").
// It is the only agent that talks to other agents.
// ──────────────────────────────────────────────────────────────────────────────
export class OrchestratorAgent extends Agent<Env> {
  // Called by EmailWatcherAgent when a job-related email is detected
  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname.endsWith('/process-email')) {
      return this.processEmail(req)
    }

    if (url.pathname.endsWith('/applications')) {
      return this.getApplications()
    }

    return new Response('not found', { status: 404 })
  }

  // ── Main Pipeline ────────────────────────────────────────────────────────────
  private async processEmail(req: Request): Promise<Response> {
    const email = await req.json<{
      from: string
      subject: string
      body?: string
    }>()

    // Extract userId from X-User-Id header (set by the Worker entry point)
    const userId = req.headers.get('X-User-Id')

    try {
      // ── Step 1: Parse the email ────────────────────────────────────────────
      const parsed = await this.callAgent<ParsedApplication>(
        this.env.ParserAgent,
        'parser',
        '/parse',
        email,
      )

      // Skip low-confidence parses to avoid noise
      if (parsed.confidence === 'low') {
        this.log('Skipping low confidence parse', parsed)
        return Response.json({ skipped: true, reason: 'low confidence' })
      }

      // ── Step 2: Track status change ────────────────────────────────────────
      const statusChange = await this.callAgent<StatusChange>(
        this.env.StatusTrackerAgent,
        'tracker',
        '/track',
        parsed,
      )

      // ── Step 3: Sync state to frontend (WebSocket clients) ─────────────────
      // setState() broadcasts to any connected frontend clients in real time
      // The Next.js frontend can subscribe via useAgentChat hook
      const currentApplications = this.sql<{
        company: string
        role: string
        status: string
      }>`
        SELECT company, role, status FROM pipeline_results ORDER BY processed_at DESC
      `

      this.setState({ applications: currentApplications })

      // ── Step 4: Store in orchestrator's own log ────────────────────────────
      this.sql`
        INSERT INTO pipeline_results (company, role, status, status_changed, processed_at)
        VALUES (
          ${parsed.company},
          ${parsed.role},
          ${parsed.status},
          ${statusChange.changed ? 1 : 0},
          ${new Date().toISOString()}
        )
      `

      // ── Step 5: Write to D1 for the frontend dashboard ────────────────────
      if (userId) {
        const now = new Date().toISOString()
        const applicationId = crypto.randomUUID()

        await this.env.DB.prepare(
          `
          INSERT INTO applications (id, user_id, company, role, status, confidence, next_steps, interview_date, status_changed, processed_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (user_id, company, role) DO UPDATE SET
            status = excluded.status,
            confidence = excluded.confidence,
            next_steps = excluded.next_steps,
            interview_date = excluded.interview_date,
            status_changed = excluded.status_changed,
            updated_at = excluded.updated_at
        `,
        )
          .bind(
            applicationId,
            userId,
            parsed.company,
            parsed.role,
            parsed.status,
            parsed.confidence,
            parsed.nextSteps ?? null,
            parsed.interviewDate ?? null,
            statusChange.changed ? 1 : 0,
            now,
            now,
          )
          .run()

        // Write status history if the status changed
        if (statusChange.changed) {
          await this.env.DB.prepare(
            `
            INSERT INTO status_history (id, application_id, user_id, from_status, to_status, reason, changed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          )
            .bind(
              crypto.randomUUID(),
              applicationId,
              userId,
              statusChange.previousStatus,
              statusChange.newStatus,
              statusChange.reason,
              now,
            )
            .run()
        }
      }

      this.log('Pipeline complete', { parsed, statusChange })

      return Response.json({ parsed, statusChange })
    } catch (err) {
      this.log('Pipeline error', { error: String(err) })
      return new Response('pipeline error', { status: 500 })
    }
  }

  // ── Read all tracked applications (for the frontend) ─────────────────────────
  private getApplications(): Response {
    const results = this.sql<{
      company: string
      role: string
      status: string
      processed_at: string
    }>`
      SELECT company, role, status, processed_at
      FROM pipeline_results
      ORDER BY processed_at DESC
    `

    return Response.json(results)
  }

  // ── Helper: call another agent's Durable Object ────────────────────────────
  private async callAgent<T>(
    namespace: DurableObjectNamespace,
    instanceName: string,
    path: string,
    body: unknown,
  ): Promise<T> {
    const id = namespace.idFromName(instanceName)
    const stub = namespace.get(id)

    const res = await stub.fetch(`https://internal${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`Agent call to ${path} failed: ${res.status}`)
    }

    return res.json<T>()
  }

  // ── Simple structured logger ────────────────────────────────────────────────
  private log(message: string, data?: unknown) {
    console.log(JSON.stringify({ message, data, ts: new Date().toISOString() }))
  }
}
