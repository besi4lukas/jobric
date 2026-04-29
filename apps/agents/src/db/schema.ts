import { z } from 'zod'

// Mirrors apps/agents/migrations/0001_schema_v1.sql.
// Keep CHECK constraints, NOT NULL choices, and enum values in sync with SQL.

// ─── Enums ───────────────────────────────────────────────────────────────────
export const ApplicationStatusSchema = z.enum([
  'applied',
  'replied',
  'interviewing',
  'offer',
  'closed',
])
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>

export const EventTypeSchema = z.enum([
  'applied',
  'replied',
  'interview',
  'offer',
  'closed',
])
export type EventType = z.infer<typeof EventTypeSchema>

export const EventSourceSchema = z.enum(['gmail', 'system', 'user'])
export type EventSource = z.infer<typeof EventSourceSchema>

// Locked to the cross-column CHECK in applications (rank can't drift from status).
export const FUNNEL_RANK_BY_STATUS = {
  closed: 0,
  applied: 1,
  replied: 2,
  interviewing: 3,
  offer: 4,
} as const satisfies Record<ApplicationStatus, number>

export type FunnelRank = (typeof FUNNEL_RANK_BY_STATUS)[ApplicationStatus]

export function funnelRankFor(status: ApplicationStatus): FunnelRank {
  return FUNNEL_RANK_BY_STATUS[status]
}

// ─── Shared field shapes ─────────────────────────────────────────────────────
const id = z.string().min(1)
const isoDateTime = z.string().datetime({ offset: true })

// ─── users ───────────────────────────────────────────────────────────────────
export const UserSchema = z.object({
  id,
  email: z.string().email(),
  createdAt: isoDateTime,
})
export type User = z.infer<typeof UserSchema>

// ─── email_accounts ──────────────────────────────────────────────────────────
export const EmailAccountSchema = z.object({
  id,
  userId: id,
  email: z.string().email(),
  encryptedRefreshToken: z.string().min(1),
  lastHistoryId: z.string().nullable(),
  watchExpiresAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
})
export type EmailAccount = z.infer<typeof EmailAccountSchema>

// ─── companies ───────────────────────────────────────────────────────────────
export const CompanySchema = z.object({
  id,
  userId: id,
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  domain: z.string().nullable(),
  createdAt: isoDateTime,
})
export type Company = z.infer<typeof CompanySchema>

// ─── applications ────────────────────────────────────────────────────────────
export const ApplicationSchema = z
  .object({
    id,
    userId: id,
    companyId: id,
    roleTitle: z.string().min(1),
    requisitionId: z.string().nullable(),
    status: ApplicationStatusSchema,
    funnelRank: z.number().int().min(0).max(4),
    firstContactAt: isoDateTime,
    lastActivityAt: isoDateTime,
  })
  .refine((a) => a.funnelRank === FUNNEL_RANK_BY_STATUS[a.status], {
    message: 'funnelRank does not match status',
    path: ['funnelRank'],
  })
export type Application = z.infer<typeof ApplicationSchema>

// ─── threads ─────────────────────────────────────────────────────────────────
export const ThreadSchema = z.object({
  id,
  userId: id,
  applicationId: id,
  gmailThreadId: z.string().min(1),
  summary: z.string().nullable(),
  summaryUpdatedAt: isoDateTime.nullable(),
  messageCount: z.number().int().nonnegative(),
})
export type Thread = z.infer<typeof ThreadSchema>

// ─── messages ────────────────────────────────────────────────────────────────
// No raw_body — snippet only. Re-fetch from Gmail when needed.
export const MessageSchema = z.object({
  id,
  userId: id,
  threadId: id,
  gmailMessageId: z.string().min(1),
  fromAddress: z.string(),
  toAddress: z.string(),
  subject: z.string().nullable(),
  snippet: z.string().nullable(),
  sentAt: isoDateTime,
  processedAt: isoDateTime.nullable(),
})
export type Message = z.infer<typeof MessageSchema>

// ─── events ──────────────────────────────────────────────────────────────────
export const EventSchema = z.object({
  id,
  userId: id,
  applicationId: id,
  eventType: EventTypeSchema,
  occurredAt: isoDateTime,
  source: EventSourceSchema,
  metadata: z.record(z.string(), z.unknown()).nullable(),
  messageId: id.nullable(),
})
export type Event = z.infer<typeof EventSchema>

// ─── parse_failures ──────────────────────────────────────────────────────────
export const ParseFailureSchema = z.object({
  id,
  userId: id,
  gmailMessageId: z.string().min(1),
  error: z.string(),
  attemptedAt: isoDateTime,
  payload: z.record(z.string(), z.unknown()),
})
export type ParseFailure = z.infer<typeof ParseFailureSchema>
