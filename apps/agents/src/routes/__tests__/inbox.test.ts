import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from '../../__tests__/helpers/d1'
import { recordMessage } from '../../db/inbox'
import type { Env } from '../../types'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  decodeCursor,
  encodeCursor,
  handleInbox,
  type InboxResponse,
} from '../inbox'

const USER = 'user_1'
const NOW = '2026-09-13T10:00:00.000Z'

function seed(db: TestDb, userId = USER) {
  db.raw
    .prepare(`INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)`)
    .run(userId, `${userId}@example.com`, NOW)
  db.raw
    .prepare(
      `INSERT INTO companies (id, user_id, name, normalized_name, created_at)
       VALUES (?, ?, 'Northwind', 'northwind', ?)`,
    )
    .run(`co_${userId}`, userId, NOW)
  db.raw
    .prepare(
      `INSERT INTO applications
         (id, user_id, company_id, role_title, status, funnel_rank,
          first_contact_at, last_activity_at)
       VALUES (?, ?, ?, 'Senior Product Designer', 'interviewing', 3, ?, ?)`,
    )
    .run(`app_${userId}`, userId, `co_${userId}`, NOW, NOW)
}

// Thread i gets one message at hour i, so newest-first order is descending i.
async function addThreads(db: TestDb, count: number, userId = USER) {
  for (let i = 0; i < count; i++) {
    await addMessage(db, `thr_${i}`, `msg_${i}`, hourIso(i), userId)
  }
}

function hourIso(hour: number): string {
  // Spread across days so `hour` can exceed 23.
  const d = new Date('2026-09-01T00:00:00.000Z')
  d.setUTCHours(hour)
  return d.toISOString()
}

async function addMessage(
  db: TestDb,
  gmailThreadId: string,
  gmailMessageId: string,
  sentAt: string,
  userId = USER,
  subject = `Subject ${gmailMessageId}`,
) {
  return recordMessage(db.d1, `app_${userId}`, {
    userId,
    gmailMessageId,
    gmailThreadId,
    fromAddress: 'priya@northwind.com',
    toAddress: 'me@gmail.com',
    subject,
    snippet: 'preview',
    sentAt,
  })
}

function envFor(db: TestDb): Env {
  return { DB: db.d1 } as unknown as Env
}

async function get(
  db: TestDb,
  query = '',
  userId = USER,
): Promise<{ status: number; body: InboxResponse | null }> {
  const res = await handleInbox(
    new Request(`https://agents.test/api/inbox${query}`),
    envFor(db),
    userId,
  )
  if (!res.ok) return { status: res.status, body: null }
  return { status: res.status, body: (await res.json()) as InboxResponse }
}

function threadIdsOf(db: TestDb, gmailThreadIds: string[]): string[] {
  return gmailThreadIds.map(
    (g) =>
      (
        db.raw
          .prepare(`SELECT id FROM threads WHERE gmail_thread_id = ?`)
          .get(g) as { id: string }
      ).id,
  )
}

describe('cursor codec', () => {
  it('round-trips and is URL-safe', () => {
    const cursor = { t: '2026-09-13T09:00:00.000Z', id: 'abc-123' }
    const encoded = encodeCursor(cursor)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeCursor(encoded)).toEqual(cursor)
  })

  it('rejects garbage, wrong shapes, and empty fields', () => {
    expect(decodeCursor('not base64!')).toBeNull()
    expect(decodeCursor(btoa('"just a string"'))).toBeNull()
    expect(decodeCursor(btoa(JSON.stringify({ t: '', id: 'x' })))).toBeNull()
    expect(decodeCursor(btoa(JSON.stringify({ t: 'x' })))).toBeNull()
  })
})

describe('GET /api/inbox', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
    seed(db)
  })

  it('returns threads newest first with application fields and no cursor when it fits', async () => {
    await addThreads(db, 3)

    const { status, body } = await get(db)

    expect(status).toBe(200)
    expect(body!.nextCursor).toBeNull()
    expect(body!.threads.map((t) => t.lastMessageAt)).toEqual([
      hourIso(2),
      hourIso(1),
      hourIso(0),
    ])
    expect(body!.threads[0]).toMatchObject({
      company: 'Northwind',
      role: 'Senior Product Designer',
      status: 'interviewing',
      summary: null,
      summaryState: 'pending',
      lastSubject: 'Subject msg_2',
      messageCount: 1,
    })
  })

  it('pages with a cursor: no overlap, no gap, null cursor on the last page', async () => {
    await addThreads(db, 25)

    const page1 = (await get(db, '?limit=10')).body!
    expect(page1.threads).toHaveLength(10)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = (await get(db, `?limit=10&cursor=${page1.nextCursor}`)).body!
    expect(page2.threads).toHaveLength(10)
    expect(page2.nextCursor).not.toBeNull()

    const page3 = (await get(db, `?limit=10&cursor=${page2.nextCursor}`)).body!
    expect(page3.threads).toHaveLength(5)
    expect(page3.nextCursor).toBeNull()

    const all = [...page1.threads, ...page2.threads, ...page3.threads]
    expect(new Set(all.map((t) => t.id)).size).toBe(25)
    expect(all.map((t) => t.lastMessageAt)).toEqual(
      Array.from({ length: 25 }, (_, i) => hourIso(24 - i)),
    )
  })

  it('does not emit a cursor when the page is exactly full', async () => {
    await addThreads(db, 10)
    const { body } = await get(db, '?limit=10')
    expect(body!.threads).toHaveLength(10)
    expect(body!.nextCursor).toBeNull()
  })

  it('is stable when new mail arrives between pages (the reason for keyset)', async () => {
    await addThreads(db, 6)
    const page1 = (await get(db, '?limit=3')).body!
    expect(page1.threads.map((t) => t.lastMessageAt)).toEqual([
      hourIso(5),
      hourIso(4),
      hourIso(3),
    ])

    // A brand-new thread lands at the top, and thread 0 gets a reply that
    // moves it to the top too. With OFFSET 3, page 2 would now start with
    // thr_4 again (duplicate) and never show one of the old rows.
    await addMessage(db, 'thr_new', 'msg_new', hourIso(100))
    await addMessage(db, 'thr_0', 'msg_0b', hourIso(101))

    const page2 = (await get(db, `?limit=3&cursor=${page1.nextCursor}`)).body!
    expect(page2.threads.map((t) => t.lastMessageAt)).toEqual([
      hourIso(2),
      hourIso(1),
    ])
    expect(page2.nextCursor).toBeNull()
    // Nothing from page 1 repeats; thr_0 (bumped) is not shown twice.
    const seen = new Set(page1.threads.map((t) => t.id))
    for (const t of page2.threads) expect(seen.has(t.id)).toBe(false)
  })

  it('breaks last_message_at ties by id so equal timestamps still page cleanly', async () => {
    const sameTime = hourIso(7)
    for (let i = 0; i < 5; i++) {
      await addMessage(db, `tie_${i}`, `tie_msg_${i}`, sameTime)
    }

    const page1 = (await get(db, '?limit=2')).body!
    const page2 = (await get(db, `?limit=2&cursor=${page1.nextCursor}`)).body!
    const page3 = (await get(db, `?limit=2&cursor=${page2.nextCursor}`)).body!

    const ids = [...page1.threads, ...page2.threads, ...page3.threads].map(
      (t) => t.id,
    )
    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
    expect(ids).toEqual([...ids].sort().reverse())
    expect(page3.nextCursor).toBeNull()
  })

  it('reflects thread state: message count, newest subject, ready summary', async () => {
    await addMessage(db, 'thr_1', 'a', hourIso(1), USER, 'First')
    await addMessage(db, 'thr_1', 'b', hourIso(3), USER, 'Third (newest)')
    await addMessage(db, 'thr_1', 'c', hourIso(2), USER, 'Second')
    const [threadId] = threadIdsOf(db, ['thr_1'])
    db.raw
      .prepare(
        `UPDATE threads SET summary = 'Priya confirmed Tuesday.',
                            summary_updated_at = ? WHERE id = ?`,
      )
      .run(hourIso(3), threadId)

    const { body } = await get(db)

    expect(body!.threads).toHaveLength(1)
    expect(body!.threads[0]).toMatchObject({
      id: threadId,
      messageCount: 3,
      lastSubject: 'Third (newest)',
      lastMessageAt: hourIso(3),
      summary: 'Priya confirmed Tuesday.',
      summaryState: 'ready',
    })
  })

  it('keeps a stale-but-present summary as ready', async () => {
    await addMessage(db, 'thr_1', 'a', hourIso(1))
    const [threadId] = threadIdsOf(db, ['thr_1'])
    db.raw
      .prepare(
        `UPDATE threads SET summary = 'Old line.', summary_updated_at = ? WHERE id = ?`,
      )
      .run(hourIso(1), threadId)
    await addMessage(db, 'thr_1', 'b', hourIso(2)) // now stale

    const { body } = await get(db)
    expect(body!.threads[0]).toMatchObject({
      summary: 'Old line.',
      summaryState: 'ready',
    })
  })

  it('is scoped to the authenticated user', async () => {
    seed(db, 'user_2')
    await addThreads(db, 2, USER)
    await addThreads(db, 3, 'user_2')

    expect((await get(db, '', USER)).body!.threads).toHaveLength(2)
    expect((await get(db, '', 'user_2')).body!.threads).toHaveLength(3)
    expect((await get(db, '', 'user_3')).body!.threads).toHaveLength(0)
  })

  it('excludes threads with no last_message_at', async () => {
    await addThreads(db, 1)
    db.raw
      .prepare(
        `INSERT INTO threads (id, user_id, application_id, gmail_thread_id, message_count, last_message_at)
         VALUES ('legacy', ?, ?, 'thr_legacy', 0, NULL)`,
      )
      .run(USER, `app_${USER}`)

    const { body } = await get(db)
    expect(body!.threads).toHaveLength(1)
    expect(body!.threads[0]!.id).not.toBe('legacy')
  })

  it('defaults and clamps limit', async () => {
    await addThreads(db, DEFAULT_LIMIT + 1)
    expect((await get(db)).body!.threads).toHaveLength(DEFAULT_LIMIT)
    expect((await get(db, `?limit=${MAX_LIMIT}`)).status).toBe(200)
    expect((await get(db, `?limit=${MAX_LIMIT + 1}`)).status).toBe(400)
    expect((await get(db, '?limit=0')).status).toBe(400)
    expect((await get(db, '?limit=abc')).status).toBe(400)
    expect((await get(db, '?limit=-5')).status).toBe(400)
  })

  it('rejects a malformed cursor with 400', async () => {
    expect((await get(db, '?cursor=nope')).status).toBe(400)
    expect((await get(db, `?cursor=${btoa('{"t":1}')}`)).status).toBe(400)
  })

  it('rejects non-GET methods', async () => {
    const res = await handleInbox(
      new Request('https://agents.test/api/inbox', { method: 'POST' }),
      envFor(db),
      USER,
    )
    expect(res.status).toBe(405)
  })
})
