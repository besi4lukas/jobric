---
name: Supabase-to-Clerk+D1 migration validation findings
description: Key institutional patterns discovered while validating the Supabase→Clerk+D1 migration — stale lockfile, missing type param, @clerk/backend not installed
type: project
---

Migration was validated on 2026-04-14 on branch JOBRIC_010. The following patterns were found and should be checked in future validations of this repo:

**Why:** This migration removed Supabase (auth + db) and added Clerk (auth) + Cloudflare D1 (database). Two critical blockers were found plus two warnings.

**Lockfile is NOT managed by pnpm for apps/agents:**

- `apps/agents` has its own `package-lock.json` (npm), not the root `pnpm-lock.yaml`.
- The pnpm lockfile does NOT include `apps/agents` at all — Turbo warns: "Workspace 'apps/agents' not found in lockfile."
- The pnpm lockfile still contains stale entries for deleted workspaces: `apps/api`, `packages/db`, `packages/queue`.
- After any migration touching `apps/agents` deps, `npm install` must be run inside `apps/agents/` separately.
- After any migration removing packages, `pnpm install` must be run at the root to clean the lockfile.

**@clerk/backend was not installed in apps/agents:**

- `@clerk/backend` is declared in `apps/agents/package.json` dependencies but was NOT installed in node_modules.
- The npm package-lock.json in `apps/agents` has no clerk entry at all.
- This causes `error TS2307: Cannot find module '@clerk/backend'` at `apps/agents/src/index.ts:2`.

**Missing type parameter on callAgent in orchestrator.ts:**

- `apps/agents/src/agents/orchestrator.ts` line 58: `callAgent()` is called without the `<StatusChange>` generic type parameter.
- `StatusChange` is exported from `types.ts` but NOT imported in `orchestrator.ts`.
- This causes 5 TypeScript errors (TS18046: 'statusChange' is of type 'unknown').

**Stale .env file (not source-controlled but still present):**

- `.env` (the actual secrets file, gitignored) still has SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, REDIS_URL, GOOGLE_REDIRECT_URI pointing to supabase.co. Needs manual cleanup.

**packages/shared/dist is stale:**

- `packages/shared/dist/config.d.ts` still exposes old schema (SUPABASE_URL, SUPABASE_ANON_KEY, etc.) because `pnpm build` was not re-run after the migration. The source `config.ts` is correct.

**How to apply:** When validating future migrations in this repo:

1. Always check both `pnpm-lock.yaml` (root) AND `apps/agents/package-lock.json` for staleness.
2. Check `packages/shared/dist/` — it needs rebuild after any config.ts change.
3. Type errors in `pnpm check-types` are the most reliable signal — always run it.
