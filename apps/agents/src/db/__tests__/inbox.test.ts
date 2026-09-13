import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from '../../__tests__/helpers/d1'
import {
  findThreadByGmailId,
  hasProcessedMessage,
  inboxInputFromEnvelope,
  recordMessage,
  type InboxMessageInput,
} from '../inbox'

const USER = 'user_1'
const NOW = '2026-09-13T10:00:00.000Z'

function seedApplication(db: TestDb, applicationId: string, role = 'Designer') {
  db.raw
    .prepare(
      `INSERT OR IGNORE INTO users (id, email, created_at) VALUES (?, ?, ?)`,
    )
    .run(USER, 'u@example.com', NOW)
  db.raw
    .prepare(
      `INSERT OR IGNORE INTO companies (id, user_id, name, normalized_name, created_at)
       VALUES ('co_1', ?, 'Northwind', 'northwind', ?)`,
    )
    .run(USER, NOW)
  db.raw
    .prepare(
      `INSERT INTO applications
         (id, user_id, company_id, role_title, status, funnel_rank,
          first_contact_at, last_activity_at)
       VALUES (?, ?, 'co_1', ?, 'applied', 1, ?, ?)`,
    )
    .run(applicationId, USER, role, NOW, NOW)
}

function input(overrides: Partial<InboxMessageInput> = {}): InboxMessageInput {
  return {
    userId: USER,
    gmailMessageId: 'msg_1',
    gmailThreadId: 'thr_1',
    fromAddress: 'priya@northwind.com',
    toAddress: 'me@gmail.com',
    subject: 'Interview confirmed',
    snippet: 'Tuesday 2pm works',
    sentAt: '2026-09-13T09:00:00.000Z',
    ...overrides,
  }
}

function threadRow(db: TestDb, gmailThreadId: string) {
  return db.raw
    .prepare(
      `SELECT id, application_id, message_count, last_message_at
       FROM threads WHERE user_id = ? AND gmail_thread_id = ?`,
    )
    .get(USER, gmailThreadId) as
    | {
        id: string
        application_id: string
        message_count: number
        last_message_at: string | null
      }
    | undefined
}

describe('migration 0004', () => {
  it('adds threads.last_message_at and the keyset index', () => {
    const db = createTestDb()
    const columns = db.raw.prepare(`PRAGMA table_info(threads)`).all() as {
      name: string
    }[]
    expect(columns.map((c) => c.name)).toContain('last_message_at')

    const index = db.raw
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'index' AND name = 'idx_threads_user_last_message'`,
      )
      .get()
    expect(index).toBeDefined()
  })
})

describe('inboxInputFromEnvelope', () => {
  const base = {
    userId: USER,
    from: 'a@b.com',
    to: 'me@gmail.com',
    subject: 'Hi',
  }

  it('returns null without both Gmail ids (Email Workers path)', () => {
    expect(inboxInputFromEnvelope(base, NOW)).toBeNull()
    expect(
      inboxInputFromEnvelope({ ...base, gmailMessageId: 'm' }, NOW),
    ).toBeNull()
    expect(
      inboxInputFromEnvelope({ ...base, gmailThreadId: 't' }, NOW),
    ).toBeNull()
  })

  it('falls back to processing time when sentAt is absent', () => {
    const result = inboxInputFromEnvelope(
      { ...base, gmailMessageId: 'm', gmailThreadId: 't' },
      NOW,
    )
    expect(result?.sentAt).toBe(NOW)
  })

  it('prefers the envelope sentAt and nulls empty text fields', () => {
    const result = inboxInputFromEnvelope(
      {
        ...base,
        subject: '',
        gmailMessageId: 'm',
        gmailThreadId: 't',
        sentAt: '2026-09-01T00:00:00.000Z',
      },
      NOW,
    )
    expect(result).toEqual({
      userId: USER,
      gmailMessageId: 'm',
      gmailThreadId: 't',
      fromAddress: 'a@b.com',
      toAddress: 'me@gmail.com',
      subject: null,
      snippet: null,
      sentAt: '2026-09-01T00:00:00.000Z',
    })
  })
})

describe('recordMessage', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
    seedApplication(db, 'app_1')
  })

  it('creates the thread bound to the application on first message', async () => {
    const recorded = await recordMessage(db.d1, 'app_1', input())

    const thread = threadRow(db, 'thr_1')
    expect(thread).toBeDefined()
    expect(recorded.threadId).toBe(thread!.id)
    expect(thread!.application_id).toBe('app_1')
    expect(thread!.message_count).toBe(1)
    expect(thread!.last_message_at).toBe('2026-09-13T09:00:00.000Z')
    expect(recorded.messageCount).toBe(1)

    const message = db.raw
      .prepare(
        `SELECT thread_id, from_address, subject, snippet, sent_at, processed_at
         FROM messages WHERE user_id = ? AND gmail_message_id = ?`,
      )
      .get(USER, 'msg_1') as Record<string, unknown>
    expect(message.thread_id).toBe(thread!.id)
    expect(message.from_address).toBe('priya@northwind.com')
    expect(message.subject).toBe('Interview confirmed')
    expect(message.snippet).toBe('Tuesday 2pm works')
    expect(message.sent_at).toBe('2026-09-13T09:00:00.000Z')
    expect(message.processed_at).toBeTypeOf('string')
  })

  it('derives count and last_message_at from rows, even out of order', async () => {
    await recordMessage(db.d1, 'app_1', input())
    // An OLDER message arriving second (Gmail history is not date-ordered)
    // must not move last_message_at backwards.
    const recorded = await recordMessage(
      db.d1,
      'app_1',
      input({ gmailMessageId: 'msg_0', sentAt: '2026-09-12T08:00:00.000Z' }),
    )

    const thread = threadRow(db, 'thr_1')!
    expect(thread.message_count).toBe(2)
    expect(thread.last_message_at).toBe('2026-09-13T09:00:00.000Z')
    expect(recorded.messageCount).toBe(2)
  })

  it('is idempotent under cron replay of the same message', async () => {
    const first = await recordMessage(db.d1, 'app_1', input())
    const replay = await recordMessage(db.d1, 'app_1', input())

    expect(replay).toEqual(first)
    expect(threadRow(db, 'thr_1')!.message_count).toBe(1)
    const count = db.raw
      .prepare(`SELECT COUNT(*) AS n FROM messages WHERE user_id = ?`)
      .get(USER) as { n: number }
    expect(count.n).toBe(1)
  })

  it('keeps the first application binding for an existing thread', async () => {
    seedApplication(db, 'app_2', 'Other role')
    await recordMessage(db.d1, 'app_1', input())
    await recordMessage(
      db.d1,
      'app_2',
      input({ gmailMessageId: 'msg_2', sentAt: '2026-09-13T11:00:00.000Z' }),
    )

    const thread = threadRow(db, 'thr_1')!
    expect(thread.application_id).toBe('app_1')
    expect(thread.message_count).toBe(2)
    expect(thread.last_message_at).toBe('2026-09-13T11:00:00.000Z')
  })

  it('keeps separate Gmail threads separate', async () => {
    await recordMessage(db.d1, 'app_1', input())
    await recordMessage(
      db.d1,
      'app_1',
      input({ gmailMessageId: 'msg_9', gmailThreadId: 'thr_2' }),
    )
    expect(threadRow(db, 'thr_1')!.message_count).toBe(1)
    expect(threadRow(db, 'thr_2')!.message_count).toBe(1)
  })

  it('scopes dedup and thread lookup to the user', async () => {
    db.raw
      .prepare(`INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)`)
      .run('user_2', 'other@example.com', NOW)
    db.raw
      .prepare(
        `INSERT INTO companies (id, user_id, name, normalized_name, created_at)
         VALUES ('co_2', 'user_2', 'Northwind', 'northwind', ?)`,
      )
      .run(NOW)
    db.raw
      .prepare(
        `INSERT INTO applications
           (id, user_id, company_id, role_title, status, funnel_rank,
            first_contact_at, last_activity_at)
         VALUES ('app_u2', 'user_2', 'co_2', 'Designer', 'applied', 1, ?, ?)`,
      )
      .run(NOW, NOW)

    await recordMessage(db.d1, 'app_1', input())
    // Same Gmail ids under a different user — a distinct thread + message.
    await recordMessage(db.d1, 'app_u2', input({ userId: 'user_2' }))

    expect(await hasProcessedMessage(db.d1, 'user_2', 'msg_1')).toBe(true)
    expect(await hasProcessedMessage(db.d1, 'user_3', 'msg_1')).toBe(false)
    const u2Thread = await findThreadByGmailId(db.d1, 'user_2', 'thr_1')
    expect(u2Thread?.applicationId).toBe('app_u2')
  })

  it('rolls back the whole batch when the application does not exist', async () => {
    await expect(recordMessage(db.d1, 'app_missing', input())).rejects.toThrow()
    expect(threadRow(db, 'thr_1')).toBeUndefined()
    expect(await hasProcessedMessage(db.d1, USER, 'msg_1')).toBe(false)
  })
})

describe('lookups', () => {
  it('report absence before and presence after a write', async () => {
    const db = createTestDb()
    seedApplication(db, 'app_1')

    expect(await hasProcessedMessage(db.d1, USER, 'msg_1')).toBe(false)
    expect(await findThreadByGmailId(db.d1, USER, 'thr_1')).toBeNull()

    const recorded = await recordMessage(db.d1, 'app_1', input())

    expect(await hasProcessedMessage(db.d1, USER, 'msg_1')).toBe(true)
    expect(await findThreadByGmailId(db.d1, USER, 'thr_1')).toEqual({
      id: recorded.threadId,
      applicationId: 'app_1',
    })
  })
})
