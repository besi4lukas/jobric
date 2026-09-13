import { describe, expect, it } from 'vitest'
import { threadTime } from '../format'
import { PILL_LABELS, STATUS_LABELS, pillStatusFor } from '../status'

describe('pillStatusFor', () => {
  it('maps every Worker application status onto an existing pill class', () => {
    expect(pillStatusFor('applied')).toBe('applied')
    expect(pillStatusFor('replied')).toBe('replied')
    expect(pillStatusFor('interviewing')).toBe('interview')
    expect(pillStatusFor('offer')).toBe('offer')
    expect(pillStatusFor('closed')).toBe('rejected')
  })

  it('also accepts the singular event_type spelling', () => {
    expect(pillStatusFor('interview')).toBe('interview')
  })

  it('has a label for every status it maps', () => {
    for (const status of [
      'applied',
      'replied',
      'interviewing',
      'offer',
      'closed',
    ]) {
      expect(PILL_LABELS[status]).toBeTruthy()
      expect(STATUS_LABELS[status]).toBeTruthy()
    }
  })
})

describe('threadTime', () => {
  const now = new Date('2026-09-13T12:00:00.000Z')

  it('is relative inside a day', () => {
    expect(threadTime('2026-09-13T11:48:00.000Z', now)).toBe('12m ago')
    expect(threadTime('2026-09-13T09:00:00.000Z', now)).toBe('3h ago')
  })

  it('is the weekday inside a week', () => {
    // 2026-09-10 is a Thursday.
    const label = threadTime('2026-09-10T09:00:00.000Z', now)
    expect(label).toBe(
      new Date('2026-09-10T09:00:00.000Z').toLocaleDateString(undefined, {
        weekday: 'short',
      }),
    )
    expect(label).not.toMatch(/ago$/)
  })

  it('is a short date beyond a week', () => {
    const label = threadTime('2026-08-01T09:00:00.000Z', now)
    expect(label).toBe(
      new Date('2026-08-01T09:00:00.000Z').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    )
  })

  it('returns null for garbage', () => {
    expect(threadTime('not a date', now)).toBeNull()
  })
})
