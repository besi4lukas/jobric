# Jobric

A pnpm + Turborepo monorepo containing the Jobric agents and web application.

## Prerequisites

- **Node.js** >= 18
- **pnpm** 9.x — install via `npm install -g pnpm@9`

## Project Structure

```
apps/
  agents/    # Cloudflare Workers + Durable Object agents
  web/       # Web frontend (Next.js)
  mobile/    # Mobile app
packages/
  ui/        # Shared React component library
  shared/    # Shared utilities and types
```

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

Copy the example env file and fill in the required values:

```bash
cp .env.example .env
```

Required variables:

| Variable                            | Description                     |
| ----------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key           |
| `CLERK_SECRET_KEY`                  | Clerk secret key                |
| `GOOGLE_CLIENT_ID`                  | Google OAuth client ID          |
| `GOOGLE_CLIENT_SECRET`              | Google OAuth client secret      |
| `NEXT_PUBLIC_AGENTS_URL`            | Cloudflare Workers agents URL   |
| `SENTRY_DSN`                        | Sentry DSN for error monitoring |
| `AXIOM_TOKEN`                       | Axiom token for logging         |
| `AXIOM_DATASET`                     | Axiom dataset name              |

### 3. Run in development

Start all apps concurrently:

```bash
pnpm dev
```

Or start a specific app:

```bash
pnpm turbo dev --filter=agents
pnpm turbo dev --filter=web
```

## Common Commands

```bash
pnpm build          # Build all apps and packages
pnpm dev            # Start all dev servers
pnpm lint           # Lint all workspaces
pnpm format         # Format with Prettier
pnpm check-types    # Type-check all workspaces
```

To run a command scoped to one app or package:

```bash
pnpm turbo build --filter=agents
pnpm turbo build --filter=web
pnpm turbo lint --filter=@repo/ui
```

## Deployment

### Agents — Cloudflare Workers

The `apps/agents` service is deployed to Cloudflare Workers. Deploy with:

```bash
pnpm turbo deploy --filter=agents
```

Set secrets via wrangler before deploying:

```bash
wrangler secret put ANTHROPIC_API_KEY --config apps/agents/wrangler.toml
wrangler secret put CLERK_SECRET_KEY --config apps/agents/wrangler.toml
```

## Tech Stack

| Concern       | Technology                              |
| ------------- | --------------------------------------- |
| Web framework | Next.js                                 |
| Language      | TypeScript 5 (strict)                   |
| UI            | React 19                                |
| Database      | Cloudflare D1 (SQLite)                  |
| Auth          | Clerk                                   |
| AI            | Vercel AI SDK + Anthropic Claude Sonnet |
| Monitoring    | Sentry + Axiom                          |
