---
name: web-typography-system-fonts
description: apps/web uses a native system font stack with Caveat as the only webfont; two gotchas (--f-script ownership, CSS is not prettier-formatted)
metadata:
  type: project
---

`apps/web` typography migrated to a native system font stack (2026-09-10).
`--f-body`/`--f-display`/`--f-mono` all resolve to `--f-ui` (system-ui stack)
defined in `landing.css` `:root`. Caveat is the only remaining webfont.

**Why:** user wanted a modern, native feel — the app should render in each
viewer's own OS UI font rather than an editorial serif set.

**How to apply — two traps worth remembering:**

1. **Never declare `--f-script` in CSS.** `next/font` owns it via the class on
   `<html>` in `layout.tsx`. A `:root` declaration collides at _equal_
   specificity (`:root` and a class are both 0-1-0), so source order decides
   the winner — and the raw name would lose next/font's metric-matched
   `Caveat Fallback`. The same trap previously existed in reverse: `dashboard.css`
   used to re-declare all four `--f-*` tokens with raw family names, which only
   worked by coincidence because next/font emitted those exact names. Tokens now
   live in exactly one place.

2. **CSS files in this repo are NOT prettier-formatted.** `pnpm format` covers
   only `*.ts, *.tsx, *.md` (see CLAUDE.md). Running `prettier --write` on
   `landing.css` or `dashboard.css` reformats the entire file (quote style,
   gradient reflow) and buries a real diff in churn. Markdown _is_ prettier-clean
   — formatting `DESIGN.md` is correct and expected.

**Verifying a font change:** build, then
`cat apps/web/.next/static/css/*.css | grep -oE "font-family:[^;}]*" | sort -u`.
Only Caveat and `var(--f-*)` references should appear. Note `apps/web/.env` is
gitignored, so a fresh worktree needs it copied from the main checkout or the
build fails on `@t3-oss/env-nextjs` validation — unrelated to whatever you changed.

See [[project-overview-d1-migration]] for other apps/web context.
