# Jobric

A pnpm + Turborepo monorepo containing the Jobric API and web application.

## Prerequisites

- **Node.js** >= 18
- **pnpm** 9.x — install via `npm install -g pnpm@9`

## Project Structure

```
apps/
  api/       # Backend API server (Node.js + TypeScript) — deployed on Railway
  web/       # Web frontend (Next.js)
  mobile/    # Mobile app
packages/
  ui/        # Shared React component library
  db/        # Database layer (Supabase)
  queue/     # Job queue (Redis/Upstash)
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

| Variable               | Description                     |
| ---------------------- | ------------------------------- |
| `SUPABASE_URL`         | Your Supabase project URL       |
| `SUPABASE_ANON_KEY`    | Supabase anonymous key          |
| `SUPABASE_SERVICE_KEY` | Supabase service role key       |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID          |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret      |
| `GOOGLE_REDIRECT_URI`  | Google OAuth redirect URI       |
| `OPENAI_API_KEY`       | OpenAI API key                  |
| `REDIS_URL`            | Redis connection URL (Upstash)  |
| `JWT_SECRET`           | Secret used to sign JWTs        |
| `PORT`                 | API port (default: `3001`)      |
| `SENTRY_DSN`           | Sentry DSN for error monitoring |
| `AXIOM_TOKEN`          | Axiom token for logging         |
| `AXIOM_DATASET`        | Axiom dataset name              |

### 3. Run in development

Start all apps concurrently:

```bash
pnpm dev
```

Or start a specific app:

```bash
pnpm turbo dev --filter=api
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
pnpm turbo build --filter=api
pnpm turbo build --filter=web
pnpm turbo lint --filter=@repo/ui
```

## Deployment

### API — Railway

The `apps/api` service is deployed on Railway. The build and start commands are defined in `railway.json` at the repo root.

**Build command:**

```bash
pnpm install --frozen-lockfile && pnpm --filter @jobric/api build
```

**Start command:**

```bash
pnpm --filter @jobric/api start
```

Set all required environment variables listed above in the Railway service dashboard before deploying.

## Tech Stack

| Concern       | Technology            |
| ------------- | --------------------- |
| Web framework | Next.js               |
| Language      | TypeScript 5 (strict) |
| UI            | React 19              |
| Database      | Supabase              |
| Auth          | Google OAuth          |
| Queue / Cache | Redis (Upstash)       |
| AI            | OpenAI                |
| Monitoring    | Sentry + Axiom        |
