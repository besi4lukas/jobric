import { z } from 'zod'

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),

  OPENAI_API_KEY: z.string().min(1),

  REDIS_URL: z.string().url(),

  PORT: z
    .string()
    .default('3001')
    .transform((v) => Number(v)),
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  JWT_SECRET: z.string().min(32),

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
      `\n❌ Invalid or missing environment variables:\n${missing.join('\n')}\n`,
    )
    process.exit(1)
  }

  return result.data
}
