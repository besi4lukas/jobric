import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, type TestDb } from '../../__tests__/helpers/d1'
import { recordMessage } from '../../db/inbox'
import type { Env } from '../../types'

// The LLM boundary is the only thing mocked. D1 is the real migrations on
// node:sqlite; threads/messages are written through db/inbox.ts so the
// staleness contract is tested against the same rows production creates.
vi.mock('ai', () => ({ generateObject: vi.fn() }))
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: vi.fn(() => 'model-stub') }))

import { generateObject } from 'ai'
import {
  MAX_MESSAGES_PER_THREAD,
  MAX_THREADS_PER_TICK,
  refreshThreadSummaries,
} from '../thread-summary'

const generateObjectMock = vi.mocked(generateObject)
const USER = 'user_1'
const NOW = '2026-09-13T10:00:00.000Z'

function seed(db: TestDb) {
  db.raw
    .prepare(`INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)`)
    .run(USER, 'u@example.com', NOW)
  db.raw
    .prepare(
      `INSERT INTO companies (id, user_id, name, normalized_name, created_at)
       VALUES ('co_1', ?, 'Northwind', 'northwind', ?)`,
    )
    .run(USER, NOW)
  db.raw
    .prepare(
      `INSERT INTO applications
         (id, user_id, company_id, role_title, status, funnel_rank,
          first_contact_at, last_activity_at)
       VALUES ('app_1', ?, 'co_1', 'Senior Product Designer', 'interviewing', 3, ?, ?)`,
    )
    .run(USER, NOW, NOW)
}

async function addMessage(
  db: TestDb,
  gmailThreadId: string,
  gmailMessageId: string,
  sentAt: string,
  text: { subject?: string; snippet?: string } = {},
) {
  return recordMessage(db.d1, 'app_1', {
    userId: USER,
    gmailMessageId,
    gmailThreadId,
    fromAddress: 'priya@northwind.com',
    toAddress: 'me@gmail.com',
    subject: text.subject ?? 'Interview',
    snippet: text.snippet ?? 'Tuesday 2pm works',
    sentAt,
  })
}

function threadRow(db: TestDb, gmailThreadId: string) {
  return db.raw
    .prepare(
      `SELECT summary, summary_updated_at, last_message_at
       FROM threads WHERE user_id = ? AND gmail_thread_id = ?`,
    )
    .get(USER, gmailThreadId) as {
    summary: string | null
    summary_updated_at: string | null
    last_message_at: string
  }
}

// The module under test only reads env.DB.
function envFor(db: TestDb): Env {
  return { DB: db.d1 } as unknown as Env
}

function promptOfCall(index: number): string {
  const args = generateObjectMock.mock.calls[index]?.[0] as
    | { prompt?: string }
    | undefined
  return args?.prompt ?? ''
}

describe('refreshThreadSummaries', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
    seed(db)
    generateObjectMock.mockReset()
    generateObjectMock.mockResolvedValue({
      object: { summary: 'Priya confirmed the interview for Tuesday at 2 PM.' },
    } as never)
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('summarizes a stale thread and stamps summary_updated_at with its last_message_at', async () => {
    await addMessage(db, 'thr_1', 'msg_1', '2026-09-13T09:00:00.000Z')

    const result = await refreshThreadSummaries(envFor(db), USER)

    expect(result).toEqual({ refreshed: 1, failed: 0 })
    const row = threadRow(db, 'thr_1')
    expect(row.summary).toBe(
      'Priya confirmed the interview for Tuesday at 2 PM.',
    )
    // Not `now` — the selected last_message_at, so anything newer is stale.
    expect(row.summary_updated_at).toBe('2026-09-13T09:00:00.000Z')
    expect(row.summary_updated_at).toBe(row.last_message_at)
  })

  it('grounds the prompt in the application and the thread messages, oldest first', async () => {
    await addMessage(db, 'thr_1', 'msg_2', '2026-09-13T09:00:00.000Z', {
      subject: 'Re: Interview',
      snippet: 'Second message',
    })
    await addMessage(db, 'thr_1', 'msg_1', '2026-09-12T09:00:00.000Z', {
      subject: 'Interview',
      snippet: 'First message',
    })

    await refreshThreadSummaries(envFor(db), USER)

    const prompt = promptOfCall(0)
    expect(prompt).toContain('Northwind — Senior Product Designer')
    expect(prompt).toContain('status: interviewing')
    expect(prompt).toContain('priya@northwind.com')
    expect(prompt.indexOf('First message')).toBeLessThan(
      prompt.indexOf('Second message'),
    )
  })

  it('caps the messages sent per thread to the newest N', async () => {
    const total = MAX_MESSAGES_PER_THREAD + 5
    for (let i = 0; i < total; i++) {
      const hour = String(i).padStart(2, '0')
      await addMessage(
        db,
        'thr_1',
        `msg_${i}`,
        `2026-09-10T${hour}:00:00.000Z`,
        {
          snippet: `body-${i}`,
        },
      )
    }

    await refreshThreadSummaries(envFor(db), USER)

    const prompt = promptOfCall(0)
    expect(prompt).toContain(`(${MAX_MESSAGES_PER_THREAD} shown)`)
    expect(prompt).toContain(`body-${total - 1}`)
    expect(prompt).not.toContain('body-0 ')
    expect(prompt).not.toContain(`body-${total - MAX_MESSAGES_PER_THREAD - 1} `)
  })

  it('does nothing when every thread is already summarized', async () => {
    await addMessage(db, 'thr_1', 'msg_1', '2026-09-13T09:00:00.000Z')
    await refreshThreadSummaries(envFor(db), USER)
    generateObjectMock.mockClear()

    const result = await refreshThreadSummaries(envFor(db), USER)

    expect(result).toEqual({ refreshed: 0, failed: 0 })
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('goes stale again when a newer message arrives', async () => {
    await addMessage(db, 'thr_1', 'msg_1', '2026-09-13T09:00:00.000Z')
    await refreshThreadSummaries(envFor(db), USER)
    generateObjectMock.mockClear()
    generateObjectMock.mockResolvedValue({
      object: { summary: 'Updated summary.' },
    } as never)

    await addMessage(db, 'thr_1', 'msg_2', '2026-09-13T12:00:00.000Z')
    const result = await refreshThreadSummaries(envFor(db), USER)

    expect(result).toEqual({ refreshed: 1, failed: 0 })
    expect(generateObjectMock).toHaveBeenCalledTimes(1)
    const row = threadRow(db, 'thr_1')
    expect(row.summary).toBe('Updated summary.')
    expect(row.summary_updated_at).toBe('2026-09-13T12:00:00.000Z')
  })

  it('does not go stale when an OLDER message is ingested late', async () => {
    await addMessage(db, 'thr_1', 'msg_2', '2026-09-13T09:00:00.000Z')
    await refreshThreadSummaries(envFor(db), USER)
    generateObjectMock.mockClear()

    // Gmail history is not date-ordered; an older message can arrive after
    // a newer one. last_message_at doesn't move, so neither does staleness.
    await addMessage(db, 'thr_1', 'msg_1', '2026-09-12T09:00:00.000Z')
    const result = await refreshThreadSummaries(envFor(db), USER)

    expect(result).toEqual({ refreshed: 0, failed: 0 })
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('processes at most MAX_THREADS_PER_TICK, newest threads first', async () => {
    const total = MAX_THREADS_PER_TICK + 2
    for (let i = 0; i < total; i++) {
      const hour = String(i).padStart(2, '0')
      await addMessage(
        db,
        `thr_${i}`,
        `msg_${i}`,
        `2026-09-10T${hour}:00:00.000Z`,
      )
    }

    const result = await refreshThreadSummaries(envFor(db), USER)

    expect(result).toEqual({ refreshed: MAX_THREADS_PER_TICK, failed: 0 })
    expect(generateObjectMock).toHaveBeenCalledTimes(MAX_THREADS_PER_TICK)
    // The two oldest threads are the ones left for the next tick.
    expect(threadRow(db, 'thr_0').summary).toBeNull()
    expect(threadRow(db, 'thr_1').summary).toBeNull()
    expect(threadRow(db, `thr_${total - 1}`).summary).not.toBeNull()
  })

  it('leaves a thread untouched on LLM failure and continues with the rest', async () => {
    await addMessage(db, 'thr_a', 'msg_a', '2026-09-13T09:00:00.000Z')
    await addMessage(db, 'thr_b', 'msg_b', '2026-09-13T08:00:00.000Z')
    generateObjectMock
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce({
        object: { summary: 'Thread B summary.' },
      } as never)

    const result = await refreshThreadSummaries(envFor(db), USER)

    expect(result).toEqual({ refreshed: 1, failed: 1 })
    const a = threadRow(db, 'thr_a')
    expect(a.summary).toBeNull()
    expect(a.summary_updated_at).toBeNull() // still stale — retried next tick
    expect(threadRow(db, 'thr_b').summary).toBe('Thread B summary.')
  })

  it('keeps the last good summary when a regeneration fails', async () => {
    await addMessage(db, 'thr_1', 'msg_1', '2026-09-13T09:00:00.000Z')
    await refreshThreadSummaries(envFor(db), USER)
    await addMessage(db, 'thr_1', 'msg_2', '2026-09-13T12:00:00.000Z')
    generateObjectMock.mockRejectedValue(new Error('boom'))

    await refreshThreadSummaries(envFor(db), USER)

    const row = threadRow(db, 'thr_1')
    expect(row.summary).toBe(
      'Priya confirmed the interview for Tuesday at 2 PM.',
    )
    expect(row.summary_updated_at).toBe('2026-09-13T09:00:00.000Z')
  })

  it('treats an empty or whitespace-only generation as a failure', async () => {
    await addMessage(db, 'thr_1', 'msg_1', '2026-09-13T09:00:00.000Z')
    generateObjectMock.mockResolvedValue({
      object: { summary: '  \n ' },
    } as never)

    const result = await refreshThreadSummaries(envFor(db), USER)

    expect(result).toEqual({ refreshed: 0, failed: 1 })
    expect(threadRow(db, 'thr_1').summary).toBeNull()
  })

  it('strips banned middot characters and truncates at a word boundary', async () => {
    await addMessage(db, 'thr_1', 'msg_1', '2026-09-13T09:00:00.000Z')
    generateObjectMock.mockResolvedValue({
      object: { summary: `Interview set · ${'word '.repeat(80)}` },
    } as never)

    await refreshThreadSummaries(envFor(db), USER)

    const summary = threadRow(db, 'thr_1').summary!
    expect(summary).not.toContain('·')
    expect(summary.length).toBeLessThanOrEqual(240)
    expect(summary.endsWith('word')).toBe(true)
  })

  it('is scoped to the user', async () => {
    await addMessage(db, 'thr_1', 'msg_1', '2026-09-13T09:00:00.000Z')

    const result = await refreshThreadSummaries(envFor(db), 'someone_else')

    expect(result).toEqual({ refreshed: 0, failed: 0 })
    expect(generateObjectMock).not.toHaveBeenCalled()
    expect(threadRow(db, 'thr_1').summary).toBeNull()
  })

  it('never throws, even when the stale-thread query itself fails', async () => {
    const broken = {
      DB: {
        prepare: () => {
          throw new Error('no such table: threads')
        },
      },
    } as unknown as Env

    await expect(refreshThreadSummaries(broken, USER)).resolves.toEqual({
      refreshed: 0,
      failed: 0,
    })
  })
})
