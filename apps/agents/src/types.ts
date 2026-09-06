import { z } from 'zod'
import type { DurableObjectNamespace } from '@cloudflare/workers-types'
import { ApplicationStatusSchema } from './db/schema'

// Re-export the canonical application status enum from db/schema so agent code
// has one source of truth.
export { ApplicationStatusSchema, type ApplicationStatus } from './db/schema'

// ─── Parsed Email Result (ParserAgent output) ──────────────────────────────────
// LLM-output shape — distinct from the DB row shape. status mirrors the DB
// enum so the parser never produces values we can't store.
export const ParsedApplicationSchema = z.object({
  company: z.string(),
  role: z.string(),
  status: ApplicationStatusSchema,
  nextSteps: z.string().optional(),
  interviewDate: z.string().optional(), // ISO date string
  requisitionId: z.string().optional(), // ATS req id, when present in email
  confidence: z.enum(['high', 'medium', 'low']),
})

export type ParsedApplication = z.infer<typeof ParsedApplicationSchema>

// ─── Status Change (StatusTrackerAgent output) ─────────────────────────────────
export const StatusChangeSchema = z.object({
  previousStatus: ApplicationStatusSchema.nullable(),
  newStatus: ApplicationStatusSchema,
  changed: z.boolean(),
  reason: z.string(),
})

export type StatusChange = z.infer<typeof StatusChangeSchema>

// ─── Inter-agent message envelopes ─────────────────────────────────────────────
// Every inter-agent message carries userId. Receivers fail loud on missing —
// silent skipping is how D1 writes got dropped on the email path.

export const EmailEnvelopeSchema = z.object({
  userId: z.string().min(1),
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  body: z.string().optional(),
  rawSize: z.number().optional(),
  // Present on the cron path (we have the Gmail API message id). Absent on
  // the Cloudflare Email Workers path. Required for parse_failures capture —
  // failures without this id can't be replayed and surface as 5xx to caller.
  gmailMessageId: z.string().min(1).optional(),
})

export type EmailEnvelope = z.infer<typeof EmailEnvelopeSchema>

export const TrackEnvelopeSchema = z.object({
  userId: z.string().min(1),
  parsed: ParsedApplicationSchema,
  // Orchestrator looks up previous status from D1 before calling the tracker —
  // keeps StatusTrackerAgent stateless (pure LLM call).
  previousStatus: ApplicationStatusSchema.nullable(),
})

export type TrackEnvelope = z.infer<typeof TrackEnvelopeSchema>

export function assertUserId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('envelope missing required userId')
  }
}

// ─── Env bindings (matches wrangler.toml) ─────────────────────────────────────
export interface Env {
  OrchestratorAgent: DurableObjectNamespace
  EmailWatcherAgent: DurableObjectNamespace
  ParserAgent: DurableObjectNamespace
  StatusTrackerAgent: DurableObjectNamespace
  ANTHROPIC_API_KEY: string
  CLERK_SECRET_KEY: string
  CLERK_PUBLISHABLE_KEY: string
  CLERK_WEBHOOK_SECRET: string
  // Gmail OAuth + token decryption (Worker secrets via `wrangler secret put`)
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GMAIL_TOKEN_KEY: string
  DB: D1Database
}
