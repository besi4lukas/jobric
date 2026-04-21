import { z } from 'zod'

const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  NODE_ENV: z.enum(['development', 'staging', 'production']),

  SENTRY_DSN: z.string().optional(),
  AXIOM_TOKEN: z.string().optional(),
  AXIOM_DATASET: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export function loadConfig(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const missing = result.error.issues.map((issue) => {
      const path = issue.path.join('.')
      return `  - ${path}: ${issue.message}`
    })

    console.error(
      `\n Invalid or missing environment variables:\n${missing.join('\n')}\n`,
    )
    throw new Error('Invalid environment variables')
  }

  return result.data
}
