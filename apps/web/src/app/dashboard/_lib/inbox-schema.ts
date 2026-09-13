import { z } from 'zod'
import { ApplicationStatusSchema } from './overview-schema'

// Web-side contract for GET /api/inbox. Fields the Worker always sends
// (`nextCursor`, `summaryState`, `lastSubject`) are defaulted here rather
// than required — the same deliberate asymmetry as overview-schema.ts, so a
// web deploy that races ahead of the Worker degrades to "no more pages /
// summary pending" instead of a ZodError blanking the tab. See
// apps/agents/src/routes/inbox.ts for the other half.
export const InboxThreadSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  status: ApplicationStatusSchema,
  summary: z.string().nullable(),
  summaryState: z.enum(['ready', 'pending']).optional().default('pending'),
  lastSubject: z.string().nullable().optional().default(null),
  lastMessageAt: z.string(),
  messageCount: z.number().int().nonnegative(),
})
export type InboxThread = z.infer<typeof InboxThreadSchema>

export const InboxResponseSchema = z.object({
  threads: z.array(InboxThreadSchema),
  nextCursor: z.string().nullable().optional().default(null),
})
export type InboxResponse = z.infer<typeof InboxResponseSchema>

export const INBOX_PAGE_SIZE = 20
