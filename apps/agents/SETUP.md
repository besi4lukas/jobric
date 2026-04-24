# Jobric Agents — Setup

Run these commands, in order, from `apps/agents/` before your first deploy.

## 1. Create the D1 database

```bash
wrangler d1 create jobric-db
```

Copy the `database_id` printed by the command into `wrangler.toml` under the
`[[d1_databases]]` block (replaces `REPLACE_WITH_YOUR_DATABASE_ID`).

## 2. Apply the schema

```bash
wrangler d1 execute jobric-db --file=schema.sql
```

This creates the `applications` and `status_history` tables and their indexes.

## 3. Set the Clerk secret

```bash
wrangler secret put CLERK_SECRET_KEY
```

Paste your Clerk secret key when prompted. Used by the Worker to verify JWTs.

## 4. Set the Anthropic secret

```bash
wrangler secret put ANTHROPIC_API_KEY
```

Paste your Anthropic API key when prompted. Used by `ParserAgent` and
`StatusTrackerAgent` for Claude calls.

## 5. Deploy

```bash
wrangler deploy
```

## Database migrations

D1 schema changes live in `migrations/` and are applied via wrangler's
built-in migrations system. Files are applied in filename order; add a new
one as `NNNN_description.sql` (e.g. `0001_add_applications.sql`).

```bash
pnpm migrate:local    # apply pending migrations to the local dev D1
pnpm migrate:prod     # apply pending migrations to the remote D1
```

Run `migrate:local` before `pnpm dev` when you've pulled new migrations,
and `migrate:prod` as part of the deploy flow.
