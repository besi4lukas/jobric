# Jobric — System Design

> **Maintenance:** this file is the living record of the system design. Whenever
> the architecture changes — new component, changed data flow, altered
> invariant, replaced dependency — update this file in the same change. A
> changelog is kept at the bottom.

Last updated: 2026-07-19 · reflects branch `jobric_011` @ `054c870`

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
                            └──────────────┘
```

The key structural idea: **the four "agents" are Durable Objects, but only one
holds meaningful responsibility.** Parser and StatusTracker are deliberately
stateless — they are LLM calls wearing a DO costume. The Orchestrator owns all
writes. D1, not DO-local SQLite, is the store of record.

### Component responsibilities

| Component            | Owns                                                      | State |
| -------------------- | --------------------------------------------------------- | ----- |
| `apps/web`           | Auth UI, OAuth dance, refresh-token encryption, dashboard | none  |
| Worker `fetch()`     | JWT verification, REST routes, agent routing              | none  |
| Worker `scheduled()` | Gmail polling loop, watermark advancement                 | none  |
| `EmailWatcherAgent`  | Cheap keyword pre-filter (cost gate before LLM)           | none  |
| `ParserAgent`        | Email → structured application data (LLM)                 | none  |
| `StatusTrackerAgent` | Prior + new status → did it change, and why (LLM)         | none  |
| `OrchestratorAgent`  | The 6-step pipeline; **all** D1 writes                    | D1    |

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
halves that don't touch:

```
  BUILT & WIRED                          BUILT, NOT WIRED
  ─────────────                          ────────────────
  Gmail OAuth ✓                          Dashboard UI ✓ (mock data)
  Cron poll ✓                            threads/messages tables ✓ (empty)
  Agent pipeline ✓                       /applications endpoint ✓ (no caller)
  D1 writes ✓
                    ╲                   ╱
                     ╲                 ╱
                      ▼               ▼
                   ┌───────────────────┐
                   │  THE MISSING SEAM │
                   │  nothing reads    │
                   │  what's written   │
                   └───────────────────┘
```

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

| Date       | Change                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-19 | Initial write-up. Documents design as-built at `054c870` on `jobric_011`.                                                                                                                          |
| 2026-09-06 | Web security headers + report-only CSP. Landing a11y pass: focus rings, `<main>`/skip link, WCAG AA contrast, reduced-motion. Email capture field removed (leaked PII via URL, unused downstream). |
