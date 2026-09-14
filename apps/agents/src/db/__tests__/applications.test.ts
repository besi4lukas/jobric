import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from '../../__tests__/helpers/d1'
import {
  advanceApplication,
  findApplicationForIngest,
  setApplicationStatusByUser,
} from '../applications'

const USER = 'user_1'
const NOW = '2026-09-14T10:00:00.000Z'
const LATER = '2026-09-14T12:00:00.000Z'

function seed(db: TestDb, userId = USER) {
  db.raw
    .prepare(`INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)`)
    .run(userId, `${userId}@example.com`, NOW)
  db.raw
    .prepare(
      `INSERT INTO companies (id, user_id, name, normalized_name, created_at)
       VALUES ('co_1', ?, 'Northwind', 'northwind', ?)`,
    )
    .run(userId, NOW)
}

function insertApplication(
  db: TestDb,
  overrides: {
    id?: string
    status?: string
    funnelRank?: number
    statusSource?: 'gmail' | 'user'
    interviewAt?: string | null
    userId?: string
  } = {},
) {
  const id = overrides.id ?? 'app_1'
  const userId = overrides.userId ?? USER
  const status = overrides.status ?? 'applied'
  const funnelRank = overrides.funnelRank ?? 1
  const statusSource = overrides.statusSource ?? 'gmail'
  db.raw
    .prepare(
      `INSERT INTO applications
         (id, user_id, company_id, role_title, status, funnel_rank,
          first_contact_at, last_activity_at, interview_at, status_source)
       VALUES (?, ?, 'co_1', 'Designer', ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      userId,
      status,
      funnelRank,
      NOW,
      NOW,
      overrides.interviewAt ?? null,
      statusSource,
    )
  return id
}

function rawApplication(db: TestDb, id: string) {
  return db.raw
    .prepare(
      `SELECT status, funnel_rank, status_source, last_activity_at, interview_at
       FROM applications WHERE id = ?`,
    )
    .get(id) as {
    status: string
    funnel_rank: number
    status_source: string
    last_activity_at: string
    interview_at: string | null
  }
}

describe('findApplicationForIngest', () => {
  it('returns null for a missing id', async () => {
    const db = createTestDb()
    expect(await findApplicationForIngest(db.d1, 'nope')).toBeNull()
  })

  it('returns the enriched shape, defaulting statusSource to gmail', async () => {
    const db = createTestDb()
    seed(db)
    insertApplication(db)

    expect(await findApplicationForIngest(db.d1, 'app_1')).toEqual({
      id: 'app_1',
      status: 'applied',
      statusSource: 'gmail',
    })
  })

  it('reflects a pinned row', async () => {
    const db = createTestDb()
    seed(db)
    insertApplication(db, {
      status: 'closed',
      funnelRank: 0,
      statusSource: 'user',
    })

    expect(await findApplicationForIngest(db.d1, 'app_1')).toEqual({
      id: 'app_1',
      status: 'closed',
      statusSource: 'user',
    })
  })
})

describe('advanceApplication', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
    seed(db)
  })

  it('refuses to change status/funnel_rank on a pinned row, but still bumps activity and COALESCEs interview_at', async () => {
    // Pin via the same path the route uses, so this exercises the real
    // pin write, not a hand-rolled status_source='user' insert.
    await setApplicationStatusByUser(db.d1, {
      userId: USER,
      id: insertApplication(db, { status: 'applied', funnelRank: 1 }),
      status: 'closed',
      now: NOW,
    })

    await advanceApplication(db.d1, {
      id: 'app_1',
      newStatus: 'offer',
      now: LATER,
      interviewAt: '2026-10-01T09:00:00.000Z',
    })

    const row = rawApplication(db, 'app_1')
    expect(row.status).toBe('closed')
    expect(row.funnel_rank).toBe(0)
    expect(row.status_source).toBe('user')
    expect(row.last_activity_at).toBe(LATER)
    expect(row.interview_at).toBe('2026-10-01T09:00:00.000Z')
  })

  it('advances an unpinned row normally', async () => {
    insertApplication(db, { status: 'applied', funnelRank: 1 })

    await advanceApplication(db.d1, {
      id: 'app_1',
      newStatus: 'interviewing',
      now: LATER,
      interviewAt: '2026-10-01T09:00:00.000Z',
    })

    const row = rawApplication(db, 'app_1')
    expect(row.status).toBe('interviewing')
    expect(row.funnel_rank).toBe(3)
    expect(row.status_source).toBe('gmail')
    expect(row.last_activity_at).toBe(LATER)
    expect(row.interview_at).toBe('2026-10-01T09:00:00.000Z')
  })

  it('keeps the existing interview_at when a new one is not supplied (COALESCE)', async () => {
    insertApplication(db, { interviewAt: '2026-09-20T09:00:00.000Z' })

    await advanceApplication(db.d1, {
      id: 'app_1',
      newStatus: 'replied',
      now: LATER,
      interviewAt: null,
    })

    expect(rawApplication(db, 'app_1').interview_at).toBe(
      '2026-09-20T09:00:00.000Z',
    )
  })
})

describe('setApplicationStatusByUser', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
    seed(db)
    insertApplication(db, { status: 'applied', funnelRank: 1 })
  })

  it('returns null when the id does not match the user', async () => {
    expect(
      await setApplicationStatusByUser(db.d1, {
        userId: 'user_2',
        id: 'app_1',
        status: 'closed',
        now: NOW,
      }),
    ).toBeNull()
  })

  it('returns null for an unknown id', async () => {
    expect(
      await setApplicationStatusByUser(db.d1, {
        userId: USER,
        id: 'nope',
        status: 'closed',
        now: NOW,
      }),
    ).toBeNull()
  })

  it('pins the row, writes exactly one events row, and returns the updated list-row', async () => {
    const row = await setApplicationStatusByUser(db.d1, {
      userId: USER,
      id: 'app_1',
      status: 'interviewing',
      now: LATER,
    })

    expect(row).toMatchObject({
      id: 'app_1',
      status: 'interviewing',
      statusSource: 'user',
      lastActivityAt: LATER,
    })

    const raw = rawApplication(db, 'app_1')
    expect(raw.funnel_rank).toBe(3)
    expect(raw.status_source).toBe('user')

    const events = db.raw
      .prepare(`SELECT * FROM events WHERE application_id = 'app_1'`)
      .all() as {
      source: string
      event_type: string
      metadata: string
      occurred_at: string
      message_id: string | null
    }[]
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      source: 'user',
      event_type: 'interview', // eventTypeForStatus('interviewing')
      occurred_at: LATER,
      message_id: null,
    })
    expect(JSON.parse(events[0]!.metadata)).toEqual({
      previousStatus: 'applied',
      reason: null,
    })
  })

  it('re-submitting the same status still pins but writes no new event', async () => {
    await setApplicationStatusByUser(db.d1, {
      userId: USER,
      id: 'app_1',
      status: 'applied',
      now: LATER,
    })

    const raw = rawApplication(db, 'app_1')
    expect(raw.status).toBe('applied')
    expect(raw.status_source).toBe('user')
    expect(raw.last_activity_at).toBe(LATER)

    const events = db.raw
      .prepare(`SELECT * FROM events WHERE application_id = 'app_1'`)
      .all()
    expect(events).toHaveLength(0)
  })
})
