# Jobric — System Design

> **Maintenance:** this file is the living record of the system design. Whenever
> the architecture changes — new component, changed data flow, altered
> invariant, replaced dependency — update this file in the same change. A
> changelog is kept at the bottom.

Last updated: 2026-09-10 · reflects branch `jobric_013` @ `c476f4e`, plus this
uncommitted change (sign-out feature: dashboard account menu + `/settings`
sign-out button; Settings folded into that menu; nav renamed)

Sections marked **⚠ Not yet wired** describe intended design that is present in
the schema or code but not connected end-to-end. See [techdebt.md](techdebt.md)
for the numbered gap list referenced throughout.

---

## 1. What we're building toward

The product thesis, from the landing copy: **"Three small steps. Then nothing."**

Every job tracker fails the same way — it's a spreadsheet that demands you keep
updating it, so you stop. Jobric's bet is that your inbox _already contains_ the
ground truth of your job search. Application confirmations, recruiter replies,
interview invites, rejections — it's all there, unstructured. The product reads
that stream and maintains the tracker for you. The user's only job is connecting
Gmail once.

That thesis produces four hard constraints that explain most of the architecture:

| Constraint                          | Why it exists                                                                              | Where it's enforced                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Read-only, narrowest scope**      | Reading someone's whole inbox is a big trust ask; it has to be visibly minimal             | `gmail.readonly` + `gmail.metadata`; no write endpoint is ever called  |
| **Forward-only ingestion**          | Never touch mail from before consent — the user consented going forward, not retroactively | `historyId` captured at connect, used as the permanent watermark floor |
| **Metadata-first, minimal at rest** | Storing inboxes is a liability                                                             | `format=metadata`; `messages` has no `raw_body` — re-fetch on demand   |
| **Zero maintenance**                | The whole value prop                                                                       | Cron poll + LLM inference; no user input anywhere in the pipeline      |

---

## 2. System topology

```
   ┌─────────────────────────────────────────────────────────────────┐
   │  BROWSER                                                        │
   │  landing → sign-up → /settings (connect) → /dashboard           │
   └────────────┬───────────────────────────────┬────────────────────┘
                │                               │
       ┌────────▼─────────┐            ┌────────▼─────────────────┐
       │  Clerk           │            │  apps/web (Next.js)      │
       │  identity        │◄───────────┤  • middleware auth gate  │
       │                  │  JWT mint  │  • OAuth dance (both     │
       └────────┬─────────┘            │    /connect + /callback) │
                │                      │  • encrypts refresh_tok  │
       svix     │                      └────────┬─────────────────┘
       webhook  │                               │ Bearer JWT
                │                               │
   ┌────────────▼───────────────────────────────▼────────────────────┐
   │  apps/agents — ONE Cloudflare Worker                            │
   │                                                                 │
   │   fetch()      → verify JWT → REST routes / agent routing       │
   │   scheduled()  → cron every 5 min → Gmail poll                  │
   │      ┊ (per tick, on change) → lib/overview-summary.ts ┊        │
   │   email()      → CF Email Workers ingress  (currently dead)     │
   │                                                                 │
   │   ┌──────────────┐  ┌──────────────┐                            │
   │   │ EmailWatcher │─►│ Orchestrator │  ← the only stateful-ish   │
   │   └──────────────┘  └──┬───────┬───┘    coordinator             │
   │      keyword filter    │       │                                │
   │                   ┌────▼───┐ ┌─▼──────────┐                     │
   │                   │ Parser │ │StatusTrack │  ← pure LLM, stateless
   │                   └────┬───┘ └─┬──────────┘                     │
   └────────────────────────┼───────┼────────────────────────────────┘
                            │       │              ┌──────────────┐
                            └───────┴─────────────►│  Anthropic   │
                                    │              │  Sonnet      │
                            ┌───────▼──────┐       └──────────────┘
                            │  D1 (SQLite) │  ◄── store of record
                            └──────┬───────┘
                                   ┊
                                   ┊  overview summary (per tick, on change)
                                   ┊  reads D1 ┈┈► calls Anthropic ┈┈► writes D1
                                   ┊  (lib/overview-summary.ts — cron-triggered
                                   ┊   only; never on the /api/overview read path)
```

The key structural idea: **the four "agents" are Durable Objects, but only one
holds meaningful responsibility.** Parser and StatusTracker are deliberately
stateless — they are LLM calls wearing a DO costume. The Orchestrator owns all
writes. D1, not DO-local SQLite, is the store of record.

### Component responsibilities

| Component                 | Owns                                                      | State                    |
| ------------------------- | --------------------------------------------------------- | ------------------------ |
| `apps/web`                | Auth UI, OAuth dance, refresh-token encryption, dashboard | none                     |
| Worker `fetch()`          | JWT verification, REST routes, agent routing              | none                     |
| Worker `scheduled()`      | Gmail polling loop, watermark advancement                 | none                     |
| `EmailWatcherAgent`       | Cheap keyword pre-filter (cost gate before LLM)           | none                     |
| `ParserAgent`             | Email → structured application data (LLM)                 | none                     |
| `StatusTrackerAgent`      | Prior + new status → did it change, and why (LLM)         | none                     |
| `OrchestratorAgent`       | The 6-step pipeline; **all** D1 writes                    | D1                       |
| `lib/overview-summary.ts` | Per-user job-search summary (LLM), cron-triggered         | `user_summaries` (cache) |

### The Overview summary

Added alongside the beta trim of the Overview tab (§6, §7). A few decisions
here are easy to get wrong by analogy with the ingestion pipeline above, so
they're spelled out:

- **Cron-coalesced, not per-email or on-read.** Generation happens once per
  account per cron tick, and only when that tick's batch actually produced a
  new `events` row — never inside `OrchestratorAgent`, and never on
  `GET /api/overview`. Per-email generation would both slow ingestion (a
  third sequential LLM call in a path that already gates the watermark) and
  regenerate the same summary N times for a burst of N emails, discarding
  N−1 of them. On-read generation would put an LLM call — and its latency
  and failure modes — on the page load path, which the design otherwise
  guarantees is guarded, cheap D1 reads (§6).
- **A plain module, not a fifth Durable Object.** There's no state to hold
  (inputs come from D1, output goes to D1), and a plain exported function is
  directly callable — a DO isn't. Parser and StatusTracker are already "LLM
  calls wearing a DO costume" (above); this doesn't add a fourth costume.
- **Stale-while-error.** A failed generation logs and increments
  `user_summaries.failure_count` but leaves `headline`/`body` untouched, so
  the last good summary keeps serving through an outage (e.g. a revoked
  Anthropic key). After 3 consecutive failures, generation is skipped
  entirely once the underlying data stops changing, so a dead key can't cost
  a call every tick forever.
- **Upcoming interviews and stale applications became summary _inputs_, not
  deleted capabilities.** The Overview tab's dedicated Upcoming and Needs-a-
  nudge cards were cut for beta scope, but `applications.interview_at` and a
  computed days-quiet figure are exactly what let the summary prose say "at
  interview" or "quiet since" — see §6.
- **Privacy.** Company names, role titles, and `events.metadata.reason`
  sentences (already LLM-written prose from the orchestrator, step 6) go to
  Anthropic — the same class of data the parser already sends, but a new
  aggregate view across a user's whole application history. No message
  bodies, no snippets, no email addresses.

---

## 3. Happy path, phase 1 — connect

```
User clicks "Connect Gmail" on /settings
        │
        ▼
GET /api/gmail/connect
  • mint 32-byte random state → httpOnly cookie
  • redirect to Google consent (readonly + metadata, access_type=offline)
        │
        ▼
 [ Google consent screen — user approves ]
        │
        ▼
GET /api/gmail/callback?code=…&state=…
  1. constant-time compare state (query vs cookie)     ← CSRF gate
  2. exchange code → { access_token, refresh_token }
  3. GET /userinfo        → which Gmail address is this?
  4. GET /gmail/profile   → CURRENT historyId          ← ★ the anchor
  5. AES-256-GCM encrypt refresh_token                 ← web holds the key
  6. POST → Worker /api/email-accounts (Bearer JWT)
        │
        ▼
Worker: verify JWT → upsert row into email_accounts
        { user_id, email, encrypted_refresh_token, last_history_id }
```

**Step 4 is the load-bearing one.** By recording the inbox's `historyId` at the
instant of consent, every future poll asks Gmail "what changed since then?" —
which makes it _structurally impossible_ to ingest pre-consent mail. It is not a
filter that could be buggy; it is an invariant of the API contract.

**Key custody:** the web app encrypts (`GMAIL_TOKEN_KEY`, AES-256-GCM), the
Worker only decrypts. Both sides must share the same base64 32-byte key, and the
wire format is `base64( iv || ciphertext+tag )` with a 12-byte IV. The Worker
deliberately exposes no `encrypt()`.

### Session termination (sign-out)

Signing out ends the Clerk browser session; it does **not** touch the Gmail
connection. Auth (Clerk) and inbox integration (Gmail) are deliberately
separate flows — the encrypted `refresh_token` in `email_accounts` and the
cron ingestion loop survive a sign-out untouched, so the user's tracker keeps
building even while signed out, and reconnecting Gmail is never a re-consent
step required just to log back in.

Two entry points call Clerk's `signOut()`/`<SignOutButton>` client-side, both
landing on `/` (`afterSignOutUrl` on `<ClerkProvider>` is the same fallback,
for sign-out paths this app doesn't control — the Clerk account portal, or a
session revoked elsewhere):

- The dashboard sidebar's account menu (`UserMenu`, replacing the old static
  `.side-footer`) — the primary path. This menu is also the only route to
  `/settings`; the sidebar's standalone Settings nav item was folded into it,
  so account-scoped actions live in one place instead of two.
- A "Sign out" button on `/settings` — a server component; `<SignOutButton>`
  is safe to use there because it renders its own client-side handler without
  requiring the page itself to be a client component.

This is purely a browser-session concern: the Worker's `verifyToken()` is
networkless with a 60s JWT TTL, so there is no server-side session to revoke
on sign-out — a signed-out client simply stops holding a valid JWT to send.
No Worker change was needed.

---

## 4. Happy path, phase 2 — ingestion

The main loop, every 5 minutes:

```
 cron tick
    │
    ▼
 SELECT * FROM email_accounts WHERE last_history_id IS NOT NULL
    │
    ├─ for each account ─ (failures isolated per-account, never break the batch)
    │      │
    │      ▼
    │  decrypt refresh_token ──► Google ──► fresh access_token
    │      │
    │      ▼
    │  history.list(startHistoryId = watermark)  ← paginates to exhaustion
    │      │  returns: [messageId…], newHistoryId
    │      ▼
    │  for each messageId: messages.get(format=metadata)
    │      │  → { from, to, subject, snippet, sizeEstimate }
    │      ▼
    │  ┌──────────────────────────────────────────────┐
    │  │ EmailWatcherAgent                            │
    │  │  keyword filter on subject+from              │
    │  │  ─ no match  → 200 "ignored", stop           │  ← cost gate:
    │  │  ─ match     → forward to Orchestrator       │    don't pay for
    │  └──────────────────┬───────────────────────────┘    LLM on newsletters
    │                     ▼
    │  ┌──────────────────────────────────────────────┐
    │  │ OrchestratorAgent — 6 steps                  │
    │  │                                              │
    │  │  1. ParserAgent  ─LLM─► {company, role,      │
    │  │                          status, confidence} │
    │  │     confidence=low ────► skip, return 200    │  ← quality gate
    │  │                                              │
    │  │  2. find-or-create company (normalized name) │
    │  │                                              │
    │  │  3. SELECT prior application + status        │
    │  │       key: (user, company, role, req_id)     │
    │  │                                              │
    │  │  4. StatusTracker ─LLM─► {changed, newStatus,│
    │  │                            reason}           │
    │  │     ↑ gets prior status as input — this is   │
    │  │       why the tracker can stay stateless     │
    │  │                                              │
    │  │  5. UPSERT applications (status + rank)      │
    │  │                                              │
    │  │  6. if changed → INSERT events (audit trail) │
    │  └──────────────────┬───────────────────────────┘
    │                     ▼
    │            2xx ─► advance watermark
    │            5xx ─► DON'T advance, retry next tick
    │
    ▼
 UPDATE email_accounts SET last_history_id = newHistoryId
```

### Reliability model

**The watermark is the whole reliability model.** It advances only after every
message in the batch is accounted for. This gives at-least-once delivery — the
design explicitly accepts duplicates as the safe failure mode, with the intent
that a `UNIQUE(user_id, gmail_message_id)` constraint absorbs them.
**⚠ Not yet wired** — that dedup was never implemented, so the safety net is
absent (techdebt #3).

`parse_failures` resolves a real tension: if a malformed email crashes the parser
forever, the watermark pins and **every subsequent email is blocked behind it** —
one bad message halts the user's entire pipeline. So the failure is written to a
dead-letter table, the call returns 2xx, and the queue drains. Failing to write
_that_ returns 5xx, because at that point pinning is genuinely correct.

### Status propagation rule

`StatusTrackerAgent` is stateless because the Orchestrator hands it the prior
status read from D1. This keeps all state in one place and makes the tracker a
pure function of `(parsed, previousStatus)`.

---

## 5. Domain model

```
users (Clerk id)
  │
  ├──< email_accounts     UNIQUE(email) — one Gmail can't serve two accounts
  │      └─ last_history_id ← the watermark
  │
  ├──< companies          normalized_name → "Acme", "ACME Inc" collapse
  │      │
  │      └──< applications   ← THE CENTRAL ENTITY
  │             │  UNIQUE(user, company, role, COALESCE(req_id,''))
  │             │  status + funnel_rank, welded by CHECK constraint
  │             │
  │             ├──< events      audit trail: what changed, when, why
  │             └──< threads ──< messages    (⚠ never written — techdebt #7)
  │
  ├──< user_summaries     1:1 per user (derived cache — safe to truncate);
  │                         distinct from threads.summary (per-thread, still
  │                         unwritten — techdebt #7)
  │
  └──< parse_failures     dead letter
```

The funnel state machine, with `funnel_rank` making "how far along am I" a
sortable integer:

```
    closed          applied        replied      interviewing      offer
      0      ◄───      1     ───►     2     ───►      3      ───►    4
      ▲                                                              │
      └──────────────────────────────────────────────────────────────┘
                     (any state can go to closed)
```

Two deliberate details:

- **`closed = 0`, not `5`.** A rejection isn't "the end of the funnel," it's
  _out_ of the funnel, so it sorts to the bottom.
- **The SQL `CHECK` constraint welds status to rank**, so the database
  physically cannot hold a row where they've drifted apart. `db/schema.ts`
  mirrors this with a Zod `.refine()`. Belt and braces on the same invariant.

Note the enum asymmetry: `application_status` uses `interviewing`, `event_type`
uses `interview`. `eventTypeForStatus()` in the orchestrator bridges them.

---

## 6. Known design gaps

The intended architecture is coherent. The gap is that it was built as two
halves that mostly don't touch — **the Overview tab is now the exception.**
It fetches `GET /api/overview` (`apps/agents/src/routes/overview.ts`, a plain
D1-reads handler registered ahead of `routeAgentRequest` — see §4) from
`apps/web/src/app/dashboard/page.tsx`, so every number on that tab now traces
to a column the pipeline actually writes, with an explicit empty state for the
common "connected, nothing ingested yet" beta case. AI Inbox and
Applications (renamed from Inbox and Companies; the `ViewKey` values remain
`inbox`/`companies`) are still the disconnected half described below.

```
  BUILT & WIRED                          BUILT, NOT WIRED
  ─────────────                          ────────────────
  Gmail OAuth ✓                          AI Inbox / Applications UI (mock)
  Cron poll ✓                            threads/messages tables ✓ (empty)
  Agent pipeline ✓                       /applications DO endpoint (no caller —
  D1 writes ✓                              superseded by /api/overview for the
  Overview UI ✓ (real D1 reads)            dashboard's read path; left in place)
                    ╲                   ╱
                     ╲                 ╱
                      ▼               ▼
                   ┌───────────────────┐
                   │  THE MISSING SEAM │
                   │  (partially closed│
                   │  — see Overview)  │
                   └───────────────────┘
```

Two fixes landed alongside the new route because Overview surfaced them
immediately: `OrchestratorAgent` only wrote an `events` row when the tracker
returned `changed: true`, which — combined with the tracker's own "only mark
changed if status genuinely progressed" prompt — meant a brand-new
application (`previousStatus: null`) could plausibly never get its first
event, silently disappearing from Recent Activity. The condition is now
`statusChange.changed || !existing`. Separately, `parsed.interviewDate` was
parsed by the LLM and then dropped on the floor; it's now validated
(`Date.parse`, NULL on failure) and persisted to the new
`applications.interview_at` column, `COALESCE`d on UPDATE so a later dateless
email can't erase a known interview date.

**Overview trimmed to beta scope.** The dedicated Upcoming and Needs-a-nudge
cards, and the "N of M got a reply" stat sub-line, are gone — replaced by "The
story so far," a cached AI summary (see §2, "The Overview summary").
`applications.interview_at` is retained and the orchestrator keeps writing
it; it didn't become dead weight, it became a summary input. Two bugs were
found and removed along the way rather than fixed in place: the deleted
`stale` query filtered `funnel_rank BETWEEN 1 AND 3`, which silently excluded
`offer` (rank 4) from "needs a nudge" (found in this review, not a prior
oversight); and `pastApplied` (`SUM(funnel_rank >= 2)`) was unsound because
`closed` is `funnel_rank` **0**, so an application that got a reply and was
later rejected fell out of the numerator while staying in the denominator —
deleted along with the line it fed, rather than patched, since nothing else
depended on it.

Three issues are architectural rather than merely buggy:

1. **The privacy stance and the inference task are in tension.** The design
   commits to metadata-only, then asks an LLM to determine application status
   from a subject line and sender alone. "Thanks for applying to Northwind —
   next steps" is genuinely ambiguous between _applied_ and _interviewing_, and
   no prompt engineering fixes missing input. `snippet` is already fetched and
   discarded — wiring it through is the cheap partial fix that stays inside the
   privacy stance. (techdebt #2)

2. **The DO singletons make this single-tenant-shaped.** `idFromName('watcher')`
   and `idFromName('main')` are global, so every user's email serializes through
   one instance doing multi-second LLM calls. (techdebt #5)

3. **The `email()` handler implies a second ingestion path** (forward mail to a
   Jobric address) that doesn't fit the Gmail-OAuth model — it looks like an
   earlier design superseded but not removed. Decide: revive or delete.
   (techdebt #14)

4. **The CSP is report-only and cannot be enforced as written.**
   `apps/web/next.config.ts` ships a Content-Security-Policy in `Report-Only`
   mode, so today it blocks nothing. Two things must be resolved before it can
   enforce: the App Router inlines its own hydration scripts (needs a
   middleware-generated nonce, or `'unsafe-inline'`, which forfeits most of the
   benefit), and the allowed Clerk origin is the dev wildcard
   `*.clerk.accounts.dev`, not the production `clerk.<domain>`. The violation
   list in the browser console is the input for that decision.

---

## 7. Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-19 | Initial write-up. Documents design as-built at `054c870` on `jobric_011`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-09-06 | Web security headers + report-only CSP. Landing a11y pass: focus rings, `<main>`/skip link, WCAG AA contrast, reduced-motion. Email capture field removed (leaked PII via URL, unused downstream).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-07 | Overview tab wired to real D1 data (§6): new `GET /api/overview` route, `applications.interview_at` + `email_accounts.last_polled_at` columns (migration `0002_overview.sql`), and an `events`-write fix so a brand-new application always gets its first Recent Activity row. Mock data removed from Overview only — Inbox/Companies unchanged (techdebt #1 partially closed, #15 fixed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-09-09 | Overview trimmed to beta scope: removed Upcoming/Needs-a-nudge cards and the unsound `pastApplied` stat line (§6). Added a cron-coalesced, cached AI summary card ("The story so far") backed by new `lib/overview-summary.ts` and `user_summaries` (migration `0003_overview_summary.sql`) — see §2, "The Overview summary". Middot (`·`) separators removed repo-wide from `apps/web/src` and recorded as a UI convention (`CLAUDE.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-09-10 | Sign-out implemented (§3, "Session termination"). New `UserMenu` accessible dropdown (`apps/web/src/app/dashboard/_components/UserMenu.tsx`) replaces the static sidebar `.side-footer`, calling `useClerk().signOut({ redirectUrl: '/' })`. A second `<SignOutButton redirectUrl="/">` entry point was added to `/settings`. `<ClerkProvider afterSignOutUrl="/">` added as a fallback for sign-out paths this app doesn't initiate. Gmail connection and `apps/agents` untouched by design — auth and inbox integration stay separate flows. The sidebar's standalone Settings nav item was folded into that menu, so `/settings` is now reached only from the account dropdown. Dashboard nav renamed for the beta: Inbox -> AI Inbox, Companies -> Applications (user-facing labels and page titles only; the `ViewKey` union, the `InboxView`/`CompaniesView` components and the `_data` modules keep their existing identifiers). The landing page's illustrative dashboard preview tab was renamed to match. |
