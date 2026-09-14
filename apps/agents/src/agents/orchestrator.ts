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
import { eventTypeForStatus, funnelRankFor, type EventType } from '../db/schema'
import {
  findThreadByGmailId,
  hasProcessedMessage,
  inboxInputFromEnvelope,
  recordMessage,
} from '../db/inbox'
import {
  advanceApplication,
  findApplicationForIngest,
  type ApplicationForIngest,
} from '../db/applications'

// ─── OrchestratorAgent ─────────────────────────────────────────────────────────
// Coordinates the pipeline: dedup → parse email → resolve thread/company →
// look up previous status → ask tracker if status changed → upsert
// application → record thread/message → write event.
// D1 (v1 schema in migrations/0001_schema_v1.sql) is the store of record.
// ──────────────────────────────────────────────────────────────────────────────
export class OrchestratorAgent extends Agent<Env> {
  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname.endsWith('/process-email')) {
      return this.processEmail(req)
    }

    return new Response('not found', { status: 404 })
  }

  private async processEmail(req: Request): Promise<Response> {
    const envelope = EmailEnvelopeSchema.parse(await req.json())
    assertUserId(envelope.userId)
    const { userId } = envelope

    try {
      const now = new Date().toISOString()
      const inbox = inboxInputFromEnvelope(envelope, now)

      // ── Step 0: Dedup ──────────────────────────────────────────────────────
      // cron.ts replays a whole batch from the same watermark after any
      // mid-batch failure. Bail here, before the parser, so a replayed
      // message costs no LLM calls and writes no duplicate events row.
      if (
        inbox &&
        (await hasProcessedMessage(this.env.DB, userId, inbox.gmailMessageId))
      ) {
        this.log('Skipping already-processed message', {
          gmailMessageId: inbox.gmailMessageId,
        })
        return Response.json({ skipped: true, reason: 'duplicate' })
      }

      // ── Step 1: Parse the email ────────────────────────────────────────────
      const parsed = await this.callAgent<ParsedApplication>(
        this.env.ParserAgent,
        'parser',
        '/parse',
        envelope satisfies EmailEnvelope,
      )

      // ── Step 2: Resolve the thread, then the application ──────────────────
      // A Gmail thread we've seen before is a stronger signal than this
      // message's parse: it anchors the application regardless of how the
      // parser spelled the company or role this time. Only an unknown thread
      // goes through company resolution + the (company, role, req) lookup.
      const knownThread = inbox
        ? await findThreadByGmailId(this.env.DB, userId, inbox.gmailThreadId)
        : null

      if (!knownThread && parsed.confidence === 'low') {
        this.log('Skipping low confidence parse', parsed)
        return Response.json({ skipped: true, reason: 'low confidence' })
      }

      let existing: ApplicationForIngest | null = null
      let companyId: string | null = null
      const requisitionId = parsed.requisitionId ?? null

      if (knownThread) {
        existing = await findApplicationForIngest(
          this.env.DB,
          knownThread.applicationId,
        )
        // applications → threads is ON DELETE CASCADE, so a thread whose
        // application vanished shouldn't exist. Fail loud rather than
        // re-create the application under a guessed company.
        if (!existing) {
          throw new Error(
            `thread ${knownThread.id} references missing application ${knownThread.applicationId}`,
          )
        }
      } else {
        const normalizedName = parsed.company.trim().toLowerCase()
        companyId = await this.findOrCreateCompany(
          userId,
          parsed.company,
          normalizedName,
          now,
        )
        const match = await this.env.DB.prepare(
          `SELECT id FROM applications
           WHERE user_id = ? AND company_id = ? AND role_title = ?
             AND COALESCE(requisition_id, '') = COALESCE(?, '')
           LIMIT 1`,
        )
          .bind(userId, companyId, parsed.role, requisitionId)
          .first<{ id: string }>()
        existing = match
          ? await findApplicationForIngest(this.env.DB, match.id)
          : null
      }

      // ── Step 3: Low-confidence reply on a known thread ────────────────────
      // "Sounds good, see you Tuesday" parses low-confidence but still
      // belongs in the inbox and still counts toward the thread. Record it
      // and touch the application, but don't ask the tracker to re-derive a
      // status from a message that doesn't carry one. (`existing` is always
      // set when knownThread is — the check is for the narrowing.)
      if (knownThread && existing && parsed.confidence === 'low' && inbox) {
        await this.env.DB.prepare(
          `UPDATE applications SET last_activity_at = ? WHERE id = ?`,
        )
          .bind(now, existing.id)
          .run()
        const recorded = await recordMessage(this.env.DB, existing.id, inbox)
        this.log('Recorded low-confidence message on known thread', {
          applicationId: existing.id,
          ...recorded,
        })
        return Response.json({
          applicationId: existing.id,
          parsed,
          statusChange: null,
          thread: recorded,
        })
      }

      // ── Step 3b: application pinned by a manual status edit ───────────────
      // A dashboard PATCH (routes/applications.ts) sets status_source='user'
      // to say "don't touch status until I edit it again." Calling
      // StatusTracker here would spend an LLM call on a status change
      // advanceApplication() would refuse to write anyway — so skip the
      // call, not just the write. The mail still ingests: last_activity_at
      // moves and interview_at can still pick up a new date; only
      // status/funnel_rank stay frozen. No `events` row — nothing changed
      // for the audit trail to record.
      if (existing && existing.statusSource === 'user') {
        const interviewAt = parseInterviewDate(parsed.interviewDate)
        await advanceApplication(this.env.DB, {
          id: existing.id,
          newStatus: existing.status,
          now,
          interviewAt,
        })
        const recorded = inbox
          ? await recordMessage(this.env.DB, existing.id, inbox)
          : null
        this.log('Status pinned by user, skipping tracker', {
          applicationId: existing.id,
        })
        return Response.json({
          applicationId: existing.id,
          parsed,
          statusChange: null,
          thread: recorded,
        })
      }

      const previousStatus: ApplicationStatus | null = existing?.status ?? null

      // ── Step 4: Ask the tracker if status changed ──────────────────────────
      const statusChange = await this.callAgent<StatusChange>(
        this.env.StatusTrackerAgent,
        'tracker',
        '/track',
        { userId, parsed, previousStatus } satisfies TrackEnvelope,
      )

      // ── Step 5: Upsert the application row ────────────────────────────────
      const newStatus = statusChange.newStatus
      const funnelRank = funnelRankFor(newStatus)
      const applicationId = existing?.id ?? crypto.randomUUID()

      // parsed.interviewDate is free text from an LLM. Validate before
      // storing — garbage would otherwise sort to the top of the Upcoming
      // card. Store NULL when unparseable.
      const interviewAt = parseInterviewDate(parsed.interviewDate)

      if (existing) {
        // existing.statusSource is 'gmail' here — the 'user' case already
        // returned in step 3b above — so advanceApplication()'s pin guard
        // is a no-op on this path, not load-bearing. Still routed through
        // it rather than a bare UPDATE so there is exactly one place that
        // knows how to write a status change.
        await advanceApplication(this.env.DB, {
          id: applicationId,
          newStatus,
          now,
          interviewAt,
        })
      } else {
        // Unreachable with a known thread (existing is always set on that
        // branch above), so companyId was resolved. Guard for the compiler
        // and for anyone who reorders the steps.
        if (!companyId) {
          throw new Error('new application without a resolved company')
        }
        await this.env.DB.prepare(
          `INSERT INTO applications
             (id, user_id, company_id, role_title, requisition_id,
              status, funnel_rank, first_contact_at, last_activity_at,
              interview_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            interviewAt,
          )
          .run()
      }

      // ── Step 6: Record the thread + message (AI Inbox) ────────────────────
      // After the application upsert so the FK target exists. null on the
      // Email Workers path (no Gmail ids) — the pipeline still completes,
      // the message just doesn't appear in the inbox.
      const recorded = inbox
        ? await recordMessage(this.env.DB, applicationId, inbox)
        : null

      // ── Step 7: Record the event when status changed ──────────────────────
      // Also fires for a brand-new application even when the tracker returns
      // changed=false — "nothing progressed" is a defensible LLM answer when
      // previousStatus is null, but it means a first sighting would otherwise
      // never land in `events` and Recent Activity would silently skip it.
      if (statusChange.changed || !existing) {
        await this.env.DB.prepare(
          `INSERT INTO events
             (id, user_id, application_id, event_type, occurred_at,
              source, metadata, message_id)
           VALUES (?, ?, ?, ?, ?, 'gmail', ?, ?)`,
        )
          .bind(
            crypto.randomUUID(),
            userId,
            applicationId,
            eventTypeForStatus(newStatus),
            now,
            JSON.stringify({
              reason: statusChange.reason,
              previousStatus: existing ? statusChange.previousStatus : null,
            }),
            recorded?.messageId ?? null,
          )
          .run()
      }

      this.log('Pipeline complete', {
        applicationId,
        parsed,
        statusChange,
        thread: recorded,
      })
      return Response.json({
        applicationId,
        parsed,
        statusChange,
        thread: recorded,
      })
    } catch (err) {
      const errorText = err instanceof Error ? err.message : String(err)
      this.log('Pipeline error', { userId: envelope.userId, error: errorText })

      // Capture to parse_failures so the message is queryable for later
      // replay, then return 2xx so upstream (cron) advances its watermark.
      // Without this, parser/Sonnet hiccups silently drop messages.
      if (envelope.gmailMessageId) {
        try {
          await this.env.DB.prepare(
            `INSERT INTO parse_failures
               (id, user_id, gmail_message_id, error, attempted_at, payload)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
            .bind(
              crypto.randomUUID(),
              envelope.userId,
              envelope.gmailMessageId,
              errorText,
              new Date().toISOString(),
              JSON.stringify(envelope),
            )
            .run()
          return Response.json({ captured: true })
        } catch (writeErr) {
          // Failure-of-the-failure: do NOT swallow. Surfacing 5xx keeps the
          // cron watermark pinned so the next run retries.
          this.log('parse_failures write failed', {
            error: String(writeErr),
          })
          return new Response('pipeline error and capture failed', {
            status: 500,
          })
        }
      }

      // No gmail_message_id (Cloudflare Email Workers path). Can't capture
      // for replay — surface 5xx so the caller sees the failure.
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

// Inverse of eventTypeForStatus() (db/schema.ts) — for rendering transition
// lines like "replied → interviewing" from a stored event_type back to the
// application status it corresponds to.
export function statusForEventType(eventType: EventType): ApplicationStatus {
  return eventType === 'interview' ? 'interviewing' : eventType
}

// parsed.interviewDate is free text from an LLM (ParsedApplicationSchema.
// interviewDate is z.string().optional(), not a validated date). Returns a
// normalized ISO-8601 string, or null when absent/unparseable so garbage
// never lands in interview_at.
function parseInterviewDate(value: string | undefined): string | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString()
}
