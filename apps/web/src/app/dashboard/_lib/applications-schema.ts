import { z } from 'zod'
import { ApplicationStatusSchema } from './overview-schema'

// Web-side contract for GET /api/applications. Fields the Worker always
// sends (`statusSource`, `interviewAt`, `nextCursor`) are defaulted here
// rather than required — the same deliberate asymmetry as inbox-schema.ts,
// so a web deploy that races ahead of the Worker degrades to "gmail-owned
// status / no interview / no more pages" instead of a ZodError blanking the
// tab. See apps/agents/src/routes/applications.ts for the other half.
export const ApplicationRowSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  requisitionId: z.string().nullable(),
  status: ApplicationStatusSchema,
  statusSource: z.enum(['gmail', 'user']).optional().default('gmail'),
  emailCount: z.number().int().min(0),
  lastActivityAt: z.string(),
  interviewAt: z.string().nullable().optional().default(null),
})
export type ApplicationRow = z.infer<typeof ApplicationRowSchema>
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>

export const ApplicationsResponseSchema = z.object({
  applications: z.array(ApplicationRowSchema),
  nextCursor: z.string().nullable().optional().default(null),
})
export type ApplicationsResponse = z.infer<typeof ApplicationsResponseSchema>

export const APPLICATIONS_PAGE_SIZE = 50
