import { z } from 'zod'
import type { DurableObjectNamespace } from '@cloudflare/workers-types'

// ─── Application Status ────────────────────────────────────────────────────────
export const ApplicationStatusSchema = z.enum([
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
  'unknown',
])

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>

// ─── Parsed Email Result (ParserAgent output) ──────────────────────────────────
export const ParsedApplicationSchema = z.object({
  company: z.string(),
  role: z.string(),
  status: ApplicationStatusSchema,
  nextSteps: z.string().optional(),
  interviewDate: z.string().optional(), // ISO date string
  applicationId: z.string().optional(), // if found in email
  confidence: z.enum(['high', 'medium', 'low']), // how confident the parse is
})

export type ParsedApplication = z.infer<typeof ParsedApplicationSchema>

// ─── Status Change (StatusTrackerAgent output) ─────────────────────────────────
export const StatusChangeSchema = z.object({
  applicationId: z.string(),
  previousStatus: ApplicationStatusSchema,
  newStatus: ApplicationStatusSchema,
  changed: z.boolean(),
  reason: z.string(), // why the status changed
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
})

export type EmailEnvelope = z.infer<typeof EmailEnvelopeSchema>

export const TrackEnvelopeSchema = z.object({
  userId: z.string().min(1),
  parsed: ParsedApplicationSchema,
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
  DB: D1Database
}
