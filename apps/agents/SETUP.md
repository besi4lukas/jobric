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
