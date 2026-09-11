import { z } from 'zod'

export const ApplicationStatusSchema = z.enum([
  'applied',
  'replied',
  'interviewing',
  'offer',
  'closed',
])

// `summary` is `.optional()` with a default here (web side) but required on
// the Worker side (apps/agents/src/routes/overview.ts) — deliberately
// asymmetric, do not "fix" this by making them match. Zod strips unknown
// keys, so if the web app is deployed ahead of the Worker (or against an
// older Worker mid-rollout that doesn't send `summary` at all), a required
// field here would throw a ZodError and blank the whole Overview page.
// Defaulting to 'unavailable' lets everything else on the page still
// render. See routes/overview.ts for the other half of this comment.
export const OverviewResponseSchema = z.object({
  account: z.object({
    connected: z.boolean(),
    email: z.string().email().optional(),
    connectedAt: z.string().optional(),
    lastSyncedAt: z.string().nullable().optional(),
  }),
  counts: z.object({
    tracked: z.number().int().nonnegative(),
    open: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
  }),
  breakdown: z.array(
    z.object({
      status: ApplicationStatusSchema,
      n: z.number().int().nonnegative(),
    }),
  ),
  recent: z.array(
    z.object({
      id: z.string(),
      company: z.string(),
      role: z.string(),
      eventType: z.enum(['applied', 'replied', 'interview', 'offer', 'closed']),
      previousStatus: ApplicationStatusSchema.nullable(),
      reason: z.string().nullable(),
      occurredAt: z.string(),
    }),
  ),
  summary: z
    .object({
      state: z.enum(['ready', 'pending', 'unavailable']),
      headline: z.string().nullable(),
      body: z.string().nullable(),
      generatedAt: z.string().nullable(),
    })
    .optional()
    .default({
      state: 'unavailable',
      headline: null,
      body: null,
      generatedAt: null,
    }),
})

export type OverviewResponse = z.infer<typeof OverviewResponseSchema>
