import { Agent } from 'agents'
import type { DurableObjectNamespace } from '@cloudflare/workers-types'
import {
  EmailEnvelopeSchema,
  assertUserId,
  type ApplicationStatus,
  type Env,
  type EmailEnvelope,
  type ParsedApplication,
  type StatusChange,
  type TrackEnvelope,
} from '../types'
import { funnelRankFor, type EventType } from '../db/schema'

// ─── OrchestratorAgent ─────────────────────────────────────────────────────────
// Coordinates the pipeline: parse email → resolve company → look up previous
// status → ask tracker if status changed → upsert application → write event.
// D1 (v1 schema in migrations/0001_schema_v1.sql) is the store of record.
// ──────────────────────────────────────────────────────────────────────────────
export class OrchestratorAgent extends Agent<Env> {
  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname.endsWith('/process-email')) {
      return this.processEmail(req)
    }

    if (url.pathname.endsWith('/applications')) {
      return this.getApplications(req)
    }

    return new Response('not found', { status: 404 })
  }

  private async processEmail(req: Request): Promise<Response> {
    const envelope = EmailEnvelopeSchema.parse(await req.json())
    assertUserId(envelope.userId)
    const { userId } = envelope

    try {
      // ── Step 1: Parse the email ────────────────────────────────────────────
      const parsed = await this.callAgent<ParsedApplication>(
        this.env.ParserAgent,
        'parser',
        '/parse',
        envelope satisfies EmailEnvelope,
      )

      if (parsed.confidence === 'low') {
        this.log('Skipping low confidence parse', parsed)
        return Response.json({ skipped: true, reason: 'low confidence' })
      }

      const now = new Date().toISOString()

      // ── Step 2: Resolve / create company ───────────────────────────────────
      const normalizedName = parsed.company.trim().toLowerCase()
      const companyId = await this.findOrCreateCompany(
        userId,
        parsed.company,
        normalizedName,
        now,
      )

      // ── Step 3: Look up previous application + status ──────────────────────
      const requisitionId = parsed.requisitionId ?? null
      const existing = await this.env.DB.prepare(
        `SELECT id, status FROM applications
         WHERE user_id = ? AND company_id = ? AND role_title = ?
           AND COALESCE(requisition_id, '') = COALESCE(?, '')
         LIMIT 1`,
      )
        .bind(userId, companyId, parsed.role, requisitionId)
        .first<{ id: string; status: ApplicationStatus }>()

      const previousStatus: ApplicationStatus | null = existing?.status ?? null

      // ── Step 4: Ask the tracker if status changed ──────────────────────────
      const statusChange = await this.callAgent<StatusChange>(
        this.env.StatusTrackerAgent,
        'tracker',
        '/track',
        { userId, parsed, previousStatus } satisfies TrackEnvelope,
      )

      // ── Step 5: Upsert the application row ────────────────────────────────
      const newStatus = parsed.status
      const funnelRank = funnelRankFor(newStatus)
      const applicationId = existing?.id ?? crypto.randomUUID()

      if (existing) {
        await this.env.DB.prepare(
          `UPDATE applications
             SET status = ?, funnel_rank = ?, last_activity_at = ?
           WHERE id = ?`,
        )
          .bind(newStatus, funnelRank, now, applicationId)
          .run()
      } else {
        await this.env.DB.prepare(
          `INSERT INTO applications
             (id, user_id, company_id, role_title, requisition_id,
              status, funnel_rank, first_contact_at, last_activity_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            applicationId,
            userId,
            companyId,
            parsed.role,
            requisitionId,
            newStatus,
            funnelRank,
            now,
            now,
          )
          .run()
      }

      // ── Step 6: Record the event when status changed ──────────────────────
      if (statusChange.changed) {
        await this.env.DB.prepare(
          `INSERT INTO events
             (id, user_id, application_id, event_type, occurred_at,
              source, metadata, message_id)
           VALUES (?, ?, ?, ?, ?, 'gmail', ?, NULL)`,
        )
          .bind(
            crypto.randomUUID(),
            userId,
            applicationId,
            eventTypeForStatus(newStatus),
            now,
            JSON.stringify({
              reason: statusChange.reason,
              previousStatus: statusChange.previousStatus,
            }),
          )
          .run()
      }

      this.log('Pipeline complete', { applicationId, parsed, statusChange })
      return Response.json({ applicationId, parsed, statusChange })
    } catch (err) {
      this.log('Pipeline error', { error: String(err) })
      return new Response('pipeline error', { status: 500 })
    }
  }

  private async findOrCreateCompany(
    userId: string,
    name: string,
    normalizedName: string,
    now: string,
  ): Promise<string> {
    const existing = await this.env.DB.prepare(
      `SELECT id FROM companies
       WHERE user_id = ? AND normalized_name = ?
       LIMIT 1`,
    )
      .bind(userId, normalizedName)
      .first<{ id: string }>()

    if (existing) return existing.id

    const id = crypto.randomUUID()
    await this.env.DB.prepare(
      `INSERT INTO companies (id, user_id, name, normalized_name, domain, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
    )
      .bind(id, userId, name, normalizedName, now)
      .run()
    return id
  }

  // ── Read tracked applications (for the frontend dashboard) ──────────────────
  private async getApplications(req: Request): Promise<Response> {
    const userId = req.headers.get('X-User-Id')
    if (!userId) {
      return new Response('unauthorized', { status: 401 })
    }

    const { results } = await this.env.DB.prepare(
      `SELECT a.id, a.role_title, a.status, a.funnel_rank,
              a.first_contact_at, a.last_activity_at,
              c.name AS company_name
       FROM applications a
       JOIN companies c ON c.id = a.company_id
       WHERE a.user_id = ?
       ORDER BY a.last_activity_at DESC`,
    )
      .bind(userId)
      .all()

    return Response.json(results)
  }

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

  private log(message: string, data?: unknown) {
    console.log(JSON.stringify({ message, data, ts: new Date().toISOString() }))
  }
}

// event_type uses 'interview' (singular); application_status uses 'interviewing'.
function eventTypeForStatus(status: ApplicationStatus): EventType {
  return status === 'interviewing' ? 'interview' : status
}
