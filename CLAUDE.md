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
pnpm turbo dev --filter=agents
pnpm turbo lint --filter=@repo/ui

# Cloudflare Agents
pnpm turbo deploy --filter=agents   # Deploy agents to Cloudflare
```

There is no test runner configured yet.

## Architecture

This is a **pnpm + Turborepo monorepo** with the following layout:

```
apps/
  agents/    # Cloudflare Workers + Durable Object agents
  web/       # Web frontend (Next.js)
  mobile/    # Mobile app
packages/
  ui/        # Shared React component library
  shared/    # Shared utilities and types
  eslint-config/      # Shared ESLint configs (base, next, react-internal)
  typescript-config/  # Shared tsconfig presets (base, nextjs, react-library)
```

**Agent architecture:** `apps/agents` is a single Cloudflare Worker with four Durable Object agents:

- **OrchestratorAgent** — coordinates the full pipeline, singleton per user
- **EmailWatcherAgent** — receives emails via Cloudflare Email Workers, filters job-related emails
- **ParserAgent** — uses Vercel AI SDK + Anthropic Claude to extract structured data
- **StatusTrackerAgent** — uses Vercel AI SDK + Anthropic to determine status changes

Each agent extends `Agent` from the `agents` package and has built-in SQLite via `this.sql`.

**Auth:** Clerk handles authentication. The Next.js app uses `@clerk/nextjs` with middleware-based route protection. The Cloudflare Worker validates Clerk JWTs via `@clerk/backend`'s `verifyToken()` using `CLERK_SECRET_KEY`.

**Database:** Cloudflare D1 (SQLite) is used as the persistent database for frontend-facing data (applications, status history). Each Durable Object agent also has its own local SQLite via `this.sql` for agent-specific data.

**Turbo pipeline:** `build` and `check-types` run after dependencies (`^build`, `^check-types`). `dev` is persistent and uncached. `deploy` depends on `build` and is uncached.

**Shared configs:** Apps and packages extend from `@repo/typescript-config` and `@repo/eslint-config` rather than defining their own.

**UI package exports:** Components are exported via the `exports` field in `packages/ui/package.json` using the `./src/*.tsx` pattern — import as `@repo/ui/button` etc.

## Tech Stack

| Concern       | Technology                              |
| ------------- | --------------------------------------- |
| Web framework | Next.js (apps/web)                      |
| Agents        | Cloudflare Workers + Durable Objects    |
| Language      | TypeScript 5 (strict, ES2022)           |
| UI            | React 19                                |
| Database      | Cloudflare D1 (SQLite)                  |
| Auth          | Clerk (JWT)                             |
| AI            | Vercel AI SDK + Anthropic Claude Sonnet |
| Monitoring    | Sentry + Axiom                          |

## Environment Variables

See `.env.example` at the repo root. Required variables include:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`
- `NEXT_PUBLIC_AGENTS_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NODE_ENV`
- `SENTRY_DSN`, `AXIOM_TOKEN`, `AXIOM_DATASET` (optional)

Cloudflare Worker secrets (set via `wrangler secret put`, not in `.env`):

- `ANTHROPIC_API_KEY`
- `CLERK_SECRET_KEY`

Cloudflare Worker vars (set in `wrangler.toml`):

- `CLERK_PUBLISHABLE_KEY`
