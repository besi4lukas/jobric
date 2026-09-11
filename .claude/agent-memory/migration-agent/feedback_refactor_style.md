---
name: refactor-style
description: How the user wants component refactors done — plan-then-confirm, one file per visible section, no premature data/barrel abstractions; run prettier --check before finishing
metadata:
  type: feedback
---

For "break this page into components" refactors: present a short plan and get a yes before touching files; split by visible page section (one zero-prop component per section); keep helpers private in the file that uses them; keep static sample data co-located as a `const` rather than creating `_data/` files; no barrel `index.ts`.

**Why:** User asked to "plan first before you execute" and "keep it simple" on the landing-page split (2026-09-11), then picked the plain 7-file split over the "fewer files" and "move data to \_data/" alternatives when offered. CI lint includes a Prettier check (see commit "Fix CI lint: format DESIGN.md"), so heredoc-written TSX must be run through `pnpm exec prettier --write` — re-indentation changes line wrapping.

**How to apply:** Any UI decomposition in `apps/web` — mirror the existing `_landing/` / `dashboard/_components/` convention, offer the plan via AskUserQuestion, and finish with `prettier --check` + `turbo check-types` + `turbo lint --filter=@jobric/web`.
