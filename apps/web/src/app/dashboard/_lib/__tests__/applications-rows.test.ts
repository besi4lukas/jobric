import { describe, expect, it } from 'vitest'
import {
  applyOptimisticStatus,
  parseStatusInput,
  replaceRow,
  restoreRow,
} from '../applications-rows'
import type { ApplicationRow } from '../applications-schema'

const rowA: ApplicationRow = {
  id: 'a1',
  company: 'Northwind',
  role: 'Designer',
  requisitionId: 'REQ-42',
  status: 'applied',
  statusSource: 'gmail',
  emailCount: 2,
  lastActivityAt: '2026-09-10T09:00:00.000Z',
  interviewAt: null,
}
const rowB: ApplicationRow = {
  id: 'b2',
  company: 'Acme',
  role: 'Engineer',
  requisitionId: null,
  status: 'replied',
  statusSource: 'gmail',
  emailCount: 1,
  lastActivityAt: '2026-09-09T09:00:00.000Z',
  interviewAt: null,
}

describe('applyOptimisticStatus', () => {
  it('sets status and pins statusSource to user, leaving order unchanged', () => {
    const next = applyOptimisticStatus([rowA, rowB], 'a1', 'interviewing')
    expect(next.map((r) => r.id)).toEqual(['a1', 'b2'])
    expect(next[0]).toMatchObject({
      status: 'interviewing',
      statusSource: 'user',
    })
    expect(next[1]).toEqual(rowB)
  })

  it('is a no-op for an unknown id', () => {
    const next = applyOptimisticStatus([rowA, rowB], 'nope', 'offer')
    expect(next).toEqual([rowA, rowB])
  })

  it('does not mutate the input array', () => {
    const original = [rowA, rowB]
    applyOptimisticStatus(original, 'a1', 'offer')
    expect(original[0]).toEqual(rowA)
  })
})

describe('replaceRow', () => {
  it('replaces the row by id, preserving position', () => {
    const updated: ApplicationRow = {
      ...rowA,
      status: 'interviewing',
      statusSource: 'user',
      lastActivityAt: '2026-09-14T10:00:00.000Z',
    }
    const next = replaceRow([rowA, rowB], updated)
    expect(next.map((r) => r.id)).toEqual(['a1', 'b2'])
    expect(next[0]).toEqual(updated)
  })

  it('is a no-op if the id is not present', () => {
    const unrelated: ApplicationRow = { ...rowA, id: 'zzz' }
    const next = replaceRow([rowA, rowB], unrelated)
    expect(next).toEqual([rowA, rowB])
  })
})

describe('restoreRow', () => {
  it('restores a snapshot by id, preserving position', () => {
    const optimistic = applyOptimisticStatus([rowA, rowB], 'a1', 'offer')
    const next = restoreRow(optimistic, rowA)
    expect(next).toEqual([rowA, rowB])
  })
})

describe('parseStatusInput', () => {
  it('accepts each of the five known statuses', () => {
    for (const status of [
      'applied',
      'replied',
      'interviewing',
      'offer',
      'closed',
    ]) {
      expect(parseStatusInput(status)).toBe(status)
    }
  })

  it('rejects an unknown status', () => {
    expect(parseStatusInput('ghosted')).toBeNull()
    expect(parseStatusInput('')).toBeNull()
  })
})
