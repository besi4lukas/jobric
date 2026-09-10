---
name: project_overview_d1_migration
description: Dashboard Overview tab wired to real Cloudflare D1 data (2026-09-07) — what changed and repo-specific gotchas hit along the way
type: project
---

Completed 2026-09-07: the dashboard Overview tab (`apps/web/src/app/dashboard`)
was rewired from 100% hardcoded mock data to real D1 reads via a new
`GET /api/overview` route on the agents Worker. Inbox and Companies tabs are
still mock (`_data/inbox.ts`, `_data/companies.ts`) — untouched, out of scope.
Full plan lived at `~/.claude/plans/go-through-the-overview-sunny-pnueli.md`.

**Why this matters for future work in this repo:**

- `packages/shared` has zero consumers and a gitignored `dist/` with no
  turbo build-dependency wiring into `check-types`. The established pattern
  (see `apps/web/src/app/settings/page.tsx`, now also
  `apps/web/src/app/dashboard/page.tsx`) is to declare the response Zod
  schema **locally on each side** (agents route + web page) rather than pull
  in `packages/shared`. Don't reach for `packages/shared` without first
  fixing that wiring — it's a bigger yak-shave than it looks.

- **Cloudflare D1's `env.DB.batch<T>([...])` result destructuring trips
  `noUncheckedIndexedAccess`** (on in `packages/typescript-config/base.json`).
  Array-destructuring a batch() result types every element as possibly
  `undefined` even though D1 guarantees one result per statement. Pattern
  used: destructure, then an explicit `if (!a || !b || ...) throw` guard
  block right after the batch call, with a comment explaining why. See
  `apps/agents/src/routes/overview.ts`.

- New non-agent HTTP routes on the Worker must be registered in
  `apps/agents/src/index.ts` **before** the `routeAgentRequest` call (same
  spot as the existing `/api/email-accounts` checks) — that ordering is
  load-bearing, not incidental.

- The orchestrator pipeline (`apps/agents/src/agents/orchestrator.ts`) had a
  real bug surfaced by this work: it only wrote an `events` row when
  `statusChange.changed` was true, but for a brand-new application
  (`previousStatus: null`) the tracker LLM can plausibly return
  `changed: false` ("nothing progressed" from nothing), so first-sighting
  events were silently dropped. Fixed to `statusChange.changed || !existing`.
  Worth checking whether similar "changed-only" write-gating exists
  elsewhere if more of the pipeline gets touched.

- D1 migrations are applied locally via
  `pnpm --filter agents exec wrangler d1 migrations apply jobric-db --local`;
  local D1 state lives under `apps/agents/.wrangler/` which is gitignored, so
  seeding/testing against it never touches the working tree.
