import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from '../../__tests__/helpers/d1'
import { recordMessage } from '../../db/inbox'
import type { Env } from '../../types'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  handleApplicationsList,
  handleApplicationStatusPatch,
  type ApplicationsResponse,
  type ApplicationRow,
} from '../applications'

const USER = 'user_1'
const NOW = '2026-09-14T10:00:00.000Z'

function seedUser(db: TestDb, userId = USER) {
  db.raw
    .prepare(`INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)`)
    .run(userId, `${userId}@example.com`, NOW)
}

function seedCompany(
  db: TestDb,
  id: string,
  userId = USER,
  name = 'Northwind',
) {
  db.raw
    .prepare(
      `INSERT INTO companies (id, user_id, name, normalized_name, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, userId, name, name.toLowerCase(), NOW)
}

// Application i gets last_activity_at at hour i, so newest-first order is
// descending i — same shape as routes/__tests__/inbox.test.ts's addThreads.
function seedApplication(
  db: TestDb,
  id: string,
  overrides: {
    userId?: string
    companyId?: string
    role?: string
    requisitionId?: string | null
    status?: string
    funnelRank?: number
    lastActivityAt?: string
  } = {},
) {
  const userId = overrides.userId ?? USER
  db.raw
    .prepare(
      `INSERT INTO applications
         (id, user_id, company_id, role_title, requisition_id, status,
          funnel_rank, first_contact_at, last_activity_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      userId,
      overrides.companyId ?? 'co_1',
      // uq_applications_user_company_role_req is keyed on (user, company,
      // role, req) — vary the role per id by default so seeding many rows
      // under the same company doesn't collide.
      overrides.role ?? `Designer ${id}`,
      overrides.requisitionId ?? null,
      overrides.status ?? 'applied',
      overrides.funnelRank ?? 1,
      overrides.lastActivityAt ?? NOW,
      overrides.lastActivityAt ?? NOW,
    )
}

function hourIso(hour: number): string {
  const d = new Date('2026-09-01T00:00:00.000Z')
  d.setUTCHours(hour)
  return d.toISOString()
}

async function addApplications(db: TestDb, count: number, userId = USER) {
  for (let i = 0; i < count; i++) {
    seedApplication(db, `app_${i}`, { userId, lastActivityAt: hourIso(i) })
  }
}

function envFor(db: TestDb): Env {
  return { DB: db.d1 } as unknown as Env
}

async function get(
  db: TestDb,
  query = '',
  userId = USER,
): Promise<{ status: number; body: ApplicationsResponse | null }> {
  const res = await handleApplicationsList(
    new Request(`https://agents.test/api/applications${query}`),
    envFor(db),
    userId,
  )
  if (!res.ok) return { status: res.status, body: null }
  return {
    status: res.status,
    body: (await res.json()) as ApplicationsResponse,
  }
}

async function patchStatus(
  db: TestDb,
  id: string,
  status: string | undefined,
  userId = USER,
  init: { method?: string; rawBody?: string } = {},
): Promise<{ status: number; body: ApplicationRow | null }> {
  const method = init.method ?? 'PATCH'
  // GET/HEAD requests can't carry a body (the fetch spec forbids it) — only
  // attach one for the methods that use it.
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : (init.rawBody ??
        (status === undefined ? undefined : JSON.stringify({ status })))
  const res = await handleApplicationStatusPatch(
    new Request(`https://agents.test/api/applications/${id}/status`, {
      method,
      body,
    }),
    envFor(db),
    userId,
    id,
  )
  if (!res.ok) return { status: res.status, body: null }
  return { status: res.status, body: (await res.json()) as ApplicationRow }
}

describe('GET /api/applications', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
    seedUser(db)
    seedCompany(db, 'co_1')
  })

  it('returns applications newest-activity first, statusSource defaulting to gmail', async () => {
    await addApplications(db, 3)

    const { status, body } = await get(db)

    expect(status).toBe(200)
    expect(body!.nextCursor).toBeNull()
    expect(body!.applications.map((a) => a.lastActivityAt)).toEqual([
      hourIso(2),
      hourIso(1),
      hourIso(0),
    ])
    expect(body!.applications[0]).toMatchObject({
      id: 'app_2',
      company: 'Northwind',
      status: 'applied',
      statusSource: 'gmail',
      requisitionId: null,
      emailCount: 0,
    })
  })

  it('breaks last_activity_at ties by id so equal timestamps still page cleanly', async () => {
    const sameTime = hourIso(7)
    for (let i = 0; i < 5; i++) {
      seedApplication(db, `tie_${i}`, { lastActivityAt: sameTime })
    }

    const page1 = (await get(db, '?limit=2')).body!
    const page2 = (await get(db, `?limit=2&cursor=${page1.nextCursor}`)).body!
    const page3 = (await get(db, `?limit=2&cursor=${page2.nextCursor}`)).body!

    const ids = [
      ...page1.applications,
      ...page2.applications,
      ...page3.applications,
    ].map((a) => a.id)
    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
    expect(ids).toEqual([...ids].sort().reverse())
    expect(page3.nextCursor).toBeNull()
  })

  it('surfaces requisitionId when set', async () => {
    seedApplication(db, 'app_req', { requisitionId: 'REQ-42' })
    const { body } = await get(db)
    expect(body!.applications[0]!.requisitionId).toBe('REQ-42')
  })

  it('sums message_count across threads for emailCount', async () => {
    seedApplication(db, 'app_1')
    await recordMessage(db.d1, 'app_1', {
      userId: USER,
      gmailMessageId: 'm1',
      gmailThreadId: 't1',
      fromAddress: 'a@b.com',
      toAddress: 'me@gmail.com',
      subject: 's1',
      snippet: null,
      sentAt: hourIso(1),
    })
    await recordMessage(db.d1, 'app_1', {
      userId: USER,
      gmailMessageId: 'm2',
      gmailThreadId: 't1',
      fromAddress: 'a@b.com',
      toAddress: 'me@gmail.com',
      subject: 's2',
      snippet: null,
      sentAt: hourIso(2),
    })
    await recordMessage(db.d1, 'app_1', {
      userId: USER,
      gmailMessageId: 'm3',
      gmailThreadId: 't2',
      fromAddress: 'a@b.com',
      toAddress: 'me@gmail.com',
      subject: 's3',
      snippet: null,
      sentAt: hourIso(3),
    })

    const { body } = await get(db)
    expect(body!.applications[0]!.emailCount).toBe(3)
  })

  it('reports 0 emailCount when an application has no threads', async () => {
    seedApplication(db, 'app_1')
    const { body } = await get(db)
    expect(body!.applications[0]!.emailCount).toBe(0)
  })

  it('is scoped to the authenticated user', async () => {
    seedUser(db, 'user_2')
    seedCompany(db, 'co_2', 'user_2')
    await addApplications(db, 2, USER)
    seedApplication(db, 'app_x', { userId: 'user_2', companyId: 'co_2' })
    seedApplication(db, 'app_y', { userId: 'user_2', companyId: 'co_2' })
    seedApplication(db, 'app_z', { userId: 'user_2', companyId: 'co_2' })

    expect((await get(db, '', USER)).body!.applications).toHaveLength(2)
    expect((await get(db, '', 'user_2')).body!.applications).toHaveLength(3)
    expect((await get(db, '', 'user_3')).body!.applications).toHaveLength(0)
  })

  it('pages with a cursor: no overlap, no gap, null cursor on the last page', async () => {
    await addApplications(db, 25)

    const page1 = (await get(db, '?limit=10')).body!
    expect(page1.applications).toHaveLength(10)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = (await get(db, `?limit=10&cursor=${page1.nextCursor}`)).body!
    expect(page2.applications).toHaveLength(10)
    expect(page2.nextCursor).not.toBeNull()

    const page3 = (await get(db, `?limit=10&cursor=${page2.nextCursor}`)).body!
    expect(page3.applications).toHaveLength(5)
    expect(page3.nextCursor).toBeNull()

    const all = [
      ...page1.applications,
      ...page2.applications,
      ...page3.applications,
    ]
    expect(new Set(all.map((a) => a.id)).size).toBe(25)
  })

  it('does not emit a cursor when the page is exactly full', async () => {
    await addApplications(db, 10)
    const { body } = await get(db, '?limit=10')
    expect(body!.applications).toHaveLength(10)
    expect(body!.nextCursor).toBeNull()
  })

  it('does not re-serve an edited row when the page underneath it shifts (keyset-under-edit)', async () => {
    await addApplications(db, 4) // app_0..app_3, hour 0..3

    const page1 = (await get(db, '?limit=2')).body! // app_3 (hour3), app_2 (hour2)
    expect(page1.applications.map((a) => a.id)).toEqual(['app_3', 'app_2'])

    // Editing app_2's status (routes/applications.ts semantics) also bumps
    // last_activity_at, moving it to the top — simulate via a direct PATCH.
    await patchStatus(db, 'app_2', 'closed')

    const page2 = (await get(db, `?limit=2&cursor=${page1.nextCursor}`)).body!
    const page2Ids = page2.applications.map((a) => a.id)
    expect(page2Ids).not.toContain('app_2')
    expect(page2Ids).toEqual(['app_1', 'app_0'])
  })

  it('defaults and clamps limit', async () => {
    await addApplications(db, DEFAULT_LIMIT + 1)
    expect((await get(db)).body!.applications).toHaveLength(DEFAULT_LIMIT)
    expect((await get(db, `?limit=${MAX_LIMIT}`)).status).toBe(200)
    expect((await get(db, `?limit=${MAX_LIMIT + 1}`)).status).toBe(400)
    expect((await get(db, '?limit=0')).status).toBe(400)
    expect((await get(db, '?limit=abc')).status).toBe(400)
  })

  it('rejects a malformed cursor with 400', async () => {
    expect((await get(db, '?cursor=nope')).status).toBe(400)
  })

  it('rejects non-GET methods', async () => {
    const res = await handleApplicationsList(
      new Request('https://agents.test/api/applications', { method: 'POST' }),
      envFor(db),
      USER,
    )
    expect(res.status).toBe(405)
  })
})

describe('PATCH /api/applications/:id/status', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
    seedUser(db)
    seedCompany(db, 'co_1')
    seedApplication(db, 'app_1', { status: 'applied', funnelRank: 1 })
  })

  it('returns the updated row with statusSource=user and lastActivityAt=now', async () => {
    const { status, body } = await patchStatus(db, 'app_1', 'interviewing')

    expect(status).toBe(200)
    expect(body).toMatchObject({
      id: 'app_1',
      status: 'interviewing',
      statusSource: 'user',
    })

    const raw = db.raw
      .prepare(
        `SELECT funnel_rank, status_source FROM applications WHERE id = 'app_1'`,
      )
      .get() as { funnel_rank: number; status_source: string }
    expect(raw.funnel_rank).toBe(3)
    expect(raw.status_source).toBe('user')
  })

  it('writes exactly one events row with source=user, the right event_type, and previousStatus', async () => {
    await patchStatus(db, 'app_1', 'interviewing')

    const events = db.raw
      .prepare(`SELECT * FROM events WHERE application_id = 'app_1'`)
      .all() as {
      source: string
      event_type: string
      metadata: string
    }[]
    expect(events).toHaveLength(1)
    expect(events[0]!.source).toBe('user')
    expect(events[0]!.event_type).toBe('interview')
    expect(JSON.parse(events[0]!.metadata)).toEqual({
      previousStatus: 'applied',
      reason: null,
    })
  })

  it('re-submitting the same status stays pinned and writes no new event', async () => {
    const { status, body } = await patchStatus(db, 'app_1', 'applied')
    expect(status).toBe(200)
    expect(body!.statusSource).toBe('user')

    const events = db.raw
      .prepare(`SELECT * FROM events WHERE application_id = 'app_1'`)
      .all()
    expect(events).toHaveLength(0)
  })

  it('400s on an invalid status value', async () => {
    expect((await patchStatus(db, 'app_1', 'ghosted')).status).toBe(400)
  })

  it('400s on non-JSON body', async () => {
    const res = await patchStatus(db, 'app_1', undefined, USER, {
      rawBody: 'not json',
    })
    expect(res.status).toBe(400)
  })

  it('400s on a missing body', async () => {
    const res = await patchStatus(db, 'app_1', undefined, USER, { rawBody: '' })
    expect(res.status).toBe(400)
  })

  it('404s for an unknown id', async () => {
    expect((await patchStatus(db, 'nope', 'closed')).status).toBe(404)
  })

  it("404s for another user's application (never leaks existence)", async () => {
    expect((await patchStatus(db, 'app_1', 'closed', 'user_2')).status).toBe(
      404,
    )
  })

  it('rejects non-PATCH methods', async () => {
    const res = await patchStatus(db, 'app_1', 'closed', USER, {
      method: 'GET',
    })
    expect(res.status).toBe(405)
  })
})
