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

### The thread summary

`threads.summary` is the one-or-two-sentence line under each AI Inbox row,
written by `apps/agents/src/lib/thread-summary.ts` — a sibling of the
Overview module, bound by the same three rules (cron-coalesced, plain module,
never on a read path). Where it differs:

- **Staleness is implicit — no extra column.** A thread needs (re)generation
  when `summary_updated_at IS NULL OR summary_updated_at < last_message_at`.
  The write stamps `summary_updated_at` with the thread's `last_message_at`
  _as selected_, not `now`, so a message that lands while the LLM call is in
  flight still reads as stale on the next tick instead of being masked. An
  older message ingested late (Gmail history is not date-ordered) doesn't
  move `last_message_at`, so it doesn't trigger a regeneration either.
- **Gated on new mail, not on a status change.** The Overview summary only
  regenerates when an `events` row was written; a thread summary goes stale
  on _any_ new message ("Sounds good, see you Tuesday" changes what the line
  should say without changing the application's status). Both hang off the
  same `newCount > 0` check in `cron.ts`.
- **Bounded spend per tick.** At most 10 stale threads per account per tick,
  newest `last_message_at` first — those are the rows at the top of the
  inbox. Each thread sends the newest 15 messages, flipped to chronological
  order, because meaning depends on sequence. Leftovers wait for the next
  tick that ingests mail for that account.
- **Stale-while-error, per thread.** A failed generation logs and leaves
  the row untouched, so the last good summary (or the UI's pending fallback,
  PR C) keeps showing and the thread is retried next tick. There is no
  `failure_count`/backoff equivalent yet — a persistently failing thread
  keeps its slot every tick with new mail (techdebt #22).
- **Privacy.** This is the first module that sends message-derived text to
  Anthropic: `from_address`, `subject`, and the Gmail `snippet` (the same
  ~100-char preview the parser already receives as its body, §4 step 1).
  Still no bodies — nothing beyond what `format=metadata` returns is ever
  fetched. Logs carry ids and error strings only, never the text.

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
    │      │  → { from, to, subject, snippet, internalDate, threadId }
    │      ▼
    │  ┌──────────────────────────────────────────────┐
    │  │ EmailWatcherAgent                            │
    │  │  keyword filter on subject+from              │
    │  │  ─ no match  → 200 "ignored", stop           │  ← cost gate:
    │  │  ─ match     → forward to Orchestrator       │    don't pay for
    │  └──────────────────┬───────────────────────────┘    LLM on newsletters
    │                     ▼
    │  ┌──────────────────────────────────────────────┐
    │  │ OrchestratorAgent — 8 steps                  │
    │  │                                              │
    │  │  0. messages.gmail_message_id seen before?   │
    │  │     yes ───────────────► skip, return 200    │  ← dedup gate:
    │  │                                              │    replays cost 0 LLM
    │  │  1. ParserAgent  ─LLM─► {company, role,      │
    │  │       (snippet as body)  status, confidence} │
    │  │                                              │
    │  │  2. threads.gmail_thread_id seen before?     │
    │  │     yes → application := thread's binding    │  ← thread anchors
    │  │     no  → find-or-create company, then       │    the application
    │  │           SELECT prior application + status  │
    │  │             key: (user, company, role, req)  │
    │  │     unknown thread AND confidence=low        │
    │  │       ────────────────► skip, return 200     │  ← quality gate
    │  │                                              │
    │  │  3. known thread AND confidence=low          │
    │  │       → record message (step 6), touch       │
    │  │         last_activity_at, return 200         │  ← no tracker call
    │  │                                              │
    │  │  4. StatusTracker ─LLM─► {changed, newStatus,│
    │  │                            reason}           │
    │  │     ↑ gets prior status as input — this is   │
    │  │       why the tracker can stay stateless     │
    │  │                                              │
    │  │  5. UPSERT applications (status + rank)      │
    │  │                                              │
    │  │  6. batch: ensure thread, INSERT message,    │
    │  │     recompute message_count/last_message_at  │
    │  │                                              │
    │  │  7. if changed → INSERT events (audit trail, │
    │  │     message_id → the row from step 6)        │
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
design explicitly accepts duplicates as the safe failure mode, and two layers
absorb them. The orchestrator's step 0 checks `messages.gmail_message_id`
before the parser runs, so a replayed message costs no LLM calls and writes no
second `events` row. Below that, `db/inbox.ts` `recordMessage()` is
idempotent by construction: inserts are `ON CONFLICT DO NOTHING` on the natural
keys, and `threads.message_count` / `last_message_at` are **recomputed from
`messages` rows inside the same D1 batch, never incremented**, so even a
replay that slipped past step 0 can't drift them. (Closes techdebt #3.)

Step 0 is a check-then-write, not a constraint-only design, but the
Orchestrator is a singleton per deployment (techdebt #5) so the two halves
can't interleave for the same user today. If the DO is ever sharded per user
that property still holds; sharding any finer would need the check folded
into the batch.

`parse_failures` resolves a real tension: if a malformed email crashes the parser
forever, the watermark pins and **every subsequent email is blocked behind it** —
one bad message halts the user's entire pipeline. So the failure is written to a
dead-letter table, the call returns 2xx, and the queue drains. Failing to write
_that_ returns 5xx, because at that point pinning is genuinely correct.

### Status propagation rule

`StatusTrackerAgent` is stateless because the Orchestrator hands it the prior
status read from D1. This keeps all state in one place and makes the tracker a
pure function of `(parsed, previousStatus)`.

### Thread binding rule

A `threads` row is bound to an application on first sight and **never
rebound**. Later messages in the same Gmail thread resolve to that application
directly (step 2), skipping company resolution — the thread is a stronger
signal than one message's parse, which might spell "Northwind" as "Northwind
Design" and would otherwise fork a second application. The corollary: a
low-confidence parse on a _known_ thread ("Sounds good, see you Tuesday") is
still recorded and still counts toward the thread; only an _unknown_ thread
with a low-confidence parse is dropped, exactly as before.

Only the cron path carries `gmailMessageId` + `gmailThreadId`. Without both
(the Cloudflare Email Workers path, techdebt #14) the pipeline runs unchanged
but records no inbox row — `inboxInputFromEnvelope()` returns null and
`events.message_id` stays NULL.

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
  │             │                  message_id → the message that caused it
  │             └──< threads      one per Gmail thread; bound to its
  │                    │            application on first sight, never rebound
  │                    │            message_count + last_message_at derived
  │                    │            from messages (recomputed, never bumped)
  │                    │            summary + summary_updated_at: cron-written,
  │                    │            stale when updated_at < last_message_at
  │                    └──< messages   snippet only, no body (privacy §1)
  │                                    UNIQUE(user, gmail_message_id) = dedup
  │
  ├──< user_summaries     1:1 per user (derived cache — safe to truncate);
  │                         distinct from threads.summary (per-thread)
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
halves that mostly don't touch — **Overview and AI Inbox are now the
exceptions.** Both fetch a plain D1-reads handler registered ahead of
`routeAgentRequest` (§4): `GET /api/overview` via
`apps/web/src/app/dashboard/_lib/fetch-overview.ts`, and `GET /api/inbox` via
`_lib/fetch-inbox.ts`, both called from that route's `page.tsx` in one
`Promise.all`. Every number and line on those tabs traces to a column the
pipeline actually writes, with explicit empty states for the common
"connected, nothing ingested yet" beta case. Applications (renamed from
Companies; the `ViewKey` value remains `companies`) is the last mock tab.

### The AI Inbox read path

- **Keyset pagination, not OFFSET.** The list is newest-first and new mail
  lands at the top between page loads; `OFFSET 20` would then repeat or skip
  whatever shifted. The cursor is the last row's `(last_message_at, id)`,
  base64url-encoded, served directly by `idx_threads_user_last_message`
  (migration 0004). `id` breaks timestamp ties so equal `last_message_at`
  values still page cleanly. The Worker fetches `limit + 1` rows to learn
  whether a next page exists without a COUNT.
- **The browser never calls the Worker.** The first page is fetched server-
  side in `page.tsx`; later pages go through a Server Action
  (`_actions/inbox.ts` → `fetchInbox`). Worker responses carry no CORS
  headers (techdebt #9), and keeping the Clerk session token server-side is
  the right shape regardless. Client state in `ThreadList` appends pages.
- **Stale-while-pending.** `summaryState` is `ready` whenever a summary
  exists — even one older than the newest message — and `pending` only when
  none has been written yet. A stale line beats a blank one while the cron
  regenerates. Pending rows show the newest subject instead.
- **Same contract asymmetry as Overview.** `nextCursor`, `summaryState`, and
  `lastSubject` are required on the Worker (`routes/inbox.ts`) and
  defaulted on the web (`_lib/inbox-schema.ts`) so a web deploy that races
  the Worker degrades instead of throwing. `_lib/status.ts` is the one
  place the Worker's `application_status` enum meets the dashboard's pill
  classes; Recent Activity uses it too.

```
  BUILT & WIRED                          BUILT, NOT WIRED
  ─────────────                          ────────────────
  Gmail OAuth ✓                          Applications UI (mock —
  Cron poll ✓                              _data/companies.ts)
  Agent pipeline ✓                       /applications DO endpoint (no caller —
  D1 writes ✓ (incl. threads/messages)     superseded by /api/overview and
  Thread summaries ✓ (cron, cached)        /api/inbox; left in place)
  Overview UI ✓ (real D1 reads)
  AI Inbox UI ✓ (real D1 reads, paged)
                    ╲                   ╱
                     ╲                 ╱
                      ▼               ▼
                   ┌───────────────────┐
                   │  THE MISSING SEAM │
                   │  (one tab left —  │
                   │   Applications)   │
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
   no prompt engineering fixes missing input. `snippet` (~100 chars) is now
   forwarded as the parser's `body` — the cheap partial fix that stays inside
   the privacy stance. It is still not a body. (techdebt #2, partially)

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

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-19 | Initial write-up. Documents design as-built at `054c870` on `jobric_011`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-09-06 | Web security headers + report-only CSP. Landing a11y pass: focus rings, `<main>`/skip link, WCAG AA contrast, reduced-motion. Email capture field removed (leaked PII via URL, unused downstream).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-07 | Overview tab wired to real D1 data (§6): new `GET /api/overview` route, `applications.interview_at` + `email_accounts.last_polled_at` columns (migration `0002_overview.sql`), and an `events`-write fix so a brand-new application always gets its first Recent Activity row. Mock data removed from Overview only — Inbox/Companies unchanged (techdebt #1 partially closed, #15 fixed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-09 | Overview trimmed to beta scope: removed Upcoming/Needs-a-nudge cards and the unsound `pastApplied` stat line (§6). Added a cron-coalesced, cached AI summary card ("The story so far") backed by new `lib/overview-summary.ts` and `user_summaries` (migration `0003_overview_summary.sql`) — see §2, "The Overview summary". Middot (`·`) separators removed repo-wide from `apps/web/src` and recorded as a UI convention (`CLAUDE.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-10 | Sign-out implemented (§3, "Session termination"). New `UserMenu` accessible dropdown (`apps/web/src/app/dashboard/_components/UserMenu.tsx`) replaces the static sidebar `.side-footer`, calling `useClerk().signOut({ redirectUrl: '/' })`. A second `<SignOutButton redirectUrl="/">` entry point was added to `/settings`. `<ClerkProvider afterSignOutUrl="/">` added as a fallback for sign-out paths this app doesn't initiate. Gmail connection and `apps/agents` untouched by design — auth and inbox integration stay separate flows. The sidebar's standalone Settings nav item was folded into that menu, so `/settings` is now reached only from the account dropdown. Dashboard nav renamed for the beta: Inbox -> AI Inbox, Companies -> Applications (user-facing labels and page titles only; the `ViewKey` union, the `InboxView`/`CompaniesView` components and the `_data` modules keep their existing identifiers). The landing page's illustrative dashboard preview tab was renamed to match. `/settings` restyled onto the dashboard's paper palette: inline styles replaced by a scoped `settings.css`, using the global `:root` tokens from `landing.css` and overriding only `--ink-mute`/`--radius-sm` (which differ between `:root` and `dashboard.css`) plus `--line-2` (dashboard-only). |
| 2026-09-10 | Web typography moved to a native system font stack. `--f-body`/`--f-display`/`--f-mono` now resolve to the viewer's OS UI font via a new `--f-ui` token in `landing.css` `:root`; Instrument Serif, Newsreader and JetBrains Mono dropped from `next/font`. Caveat is retained as the only webfont (brand script accents) and remains owned solely by `layout.tsx` — `--f-script` must not be redeclared in CSS or it collides with next/font's generated family at equal specificity. `dashboard.css` no longer redeclares the font tokens; they inherit from `:root`. Display headings retuned for sans optics (weight 600–700, tighter tracking, display-size italics converted to color contrast) and stat figures set in `tabular-nums`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-09-13 | AI Inbox ingestion (PR A of three; §4 steps 0/2/3/6, "Thread binding rule", §5). `threads` and `messages` are now written by the orchestrator via `apps/agents/src/db/inbox.ts` — one transactional D1 batch that ensures the thread, inserts the message, and recomputes `message_count`/`last_message_at` from rows. Migration `0004_inbox.sql` adds `threads.last_message_at` (the future Inbox sort key) and a `(user_id, last_message_at DESC, id DESC)` keyset index. `gmail/client.ts` now reads `internalDate` → `sentAt`; the cron envelope forwards `gmailThreadId`, `snippet`, `sentAt`, and passes the snippet as the parser's `body`. Orchestrator: dedup on `gmail_message_id` before any LLM call, known-thread anchoring of the application, low-confidence replies on known threads recorded instead of dropped, `events.message_id` populated. First tests in `apps/agents` (vitest, `node:sqlite` running the real migrations — `src/__tests__/helpers/d1.ts`). Techdebt #3 and #7 closed, #2 partially. **Deploy order: `migrate:prod` before `turbo deploy`.**                                                                                                                                                                                                                                    |
| 2026-09-13 | AI Inbox summaries (PR B of three; §2 "The thread summary", §5). New `apps/agents/src/lib/thread-summary.ts` writes `threads.summary` / `summary_updated_at` from the cron tick, gated on `newCount > 0` per account alongside the Overview summary. Staleness is implicit (`summary_updated_at < last_message_at`, stamped with the selected `last_message_at` rather than `now`); at most 10 threads per tick, newest first; newest 15 messages per thread in chronological order; failures leave the row untouched. No migration. Reuses `sanitizeSummaryText` from `overview-summary.ts`. 13 tests mock only the `ai` boundary and drive the module through `recordMessage()` on the real migrations. Read path and UI remain PR C.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-13 | AI Inbox read path (PR C of three; §6 "The AI Inbox read path"). New `GET /api/inbox?limit=&cursor=` (`apps/agents/src/routes/inbox.ts`): plain D1 reads, keyset cursor on `(last_message_at, id)` base64url-encoded, `limit + 1` probe for `nextCursor`, clamp 1–50, 400 on bad input. Web: `_lib/inbox-schema.ts` + `_lib/fetch-inbox.ts` (server-only), first page fetched in `page.tsx` alongside Overview, later pages via Server Action `_actions/inbox.ts`; `ThreadList` is now a client component with "Load more"; `InboxView` gains Overview's three empty states; new `_lib/status.ts` shared with Recent Activity; `threadTime()` in `_lib/format.ts`. `_data/inbox.ts` and the mock `Thread` type deleted. First tests in `apps/web` (vitest, pure TS: schema defaults, status mapping, `threadTime`). Agents: 14 route tests incl. a new-mail-between-pages case. No migration; nothing to run before deploy. Techdebt #1 closed for Inbox (Applications remains).                                                                                                                                                                                                                                                                                                                                       |
