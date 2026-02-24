# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Root-level (runs across all workspaces via Turbo)
pnpm build           # Build all apps and packages
pnpm dev             # Start all dev servers concurrently
pnpm lint            # Lint all workspaces
pnpm format          # Format with Prettier (*.ts, *.tsx, *.md)
pnpm check-types     # Type-check all workspaces

# Filter to a specific app or package
pnpm turbo build --filter=web
pnpm turbo dev --filter=api
pnpm turbo lint --filter=@repo/ui
```

There is no test runner configured yet.

## Architecture

This is a **pnpm + Turborepo monorepo** with the following layout:

```
apps/
  api/       # Backend API server (Node.js)
  web/       # Web frontend (Next.js)
  mobile/    # Mobile app
packages/
  ui/        # Shared React component library
  db/        # Database layer (Supabase)
  queue/     # Job queue (Redis/Upstash)
  shared/    # Shared utilities and types
  eslint-config/      # Shared ESLint configs (base, next, react-internal)
  typescript-config/  # Shared tsconfig presets (base, nextjs, react-library)
```

**Turbo pipeline:** `build` and `check-types` run after dependencies (`^build`, `^check-types`). `dev` is persistent and uncached. Build outputs are `.next/**` (excluding cache).

**Shared configs:** Apps and packages extend from `@repo/typescript-config` and `@repo/eslint-config` rather than defining their own.

**UI package exports:** Components are exported via the `exports` field in `packages/ui/package.json` using the `./src/*.tsx` pattern — import as `@repo/ui/button` etc.

## Tech Stack

| Concern | Technology |
|---|---|
| Web framework | Next.js (apps/web) |
| Language | TypeScript 5 (strict, ES2022) |
| UI | React 19 |
| Database | Supabase |
| Auth | Google OAuth |
| Queue/Cache | Redis (Upstash) |
| AI | OpenAI |
| Monitoring | Sentry + Axiom |

## Environment Variables

See `.env.example` at the repo root. Required variables include:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `OPENAI_API_KEY`
- `REDIS_URL`
- `JWT_SECRET`
- `PORT` (default 3001), `NODE_ENV`
- `SENTRY_DSN`, `AXIOM_TOKEN`, `AXIOM_DATASET`
