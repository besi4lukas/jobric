---
name: Auth & DB migration from Supabase to Clerk + D1
description: Supabase was fully removed and replaced with Clerk for auth and Cloudflare D1 for persistent database as of 2026-04-14
type: project
---

Auth and database migration completed 2026-04-14 on branch JOBRIC_010.

**Why:** Supabase was dropped entirely in favor of Clerk (auth) and Cloudflare D1 (database) to consolidate infrastructure onto Cloudflare's platform alongside the existing Workers + Durable Objects architecture.

**How to apply:** All auth in the monorepo now flows through Clerk. The web app uses `@clerk/nextjs` with middleware-based route protection. The Cloudflare Worker validates Clerk JWTs via `@clerk/backend`'s `verifyToken()`. The `packages/db` package was deleted -- D1 is accessed directly via the `DB` binding in wrangler.toml. Agent-local SQLite (`this.sql`) remains unchanged.
