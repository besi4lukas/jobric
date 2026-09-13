import { describe, expect, it } from 'vitest'
import { InboxResponseSchema } from '../inbox-schema'

const thread = {
  id: 't1',
  company: 'Northwind',
  role: 'Designer',
  status: 'interviewing',
  summary: 'Priya confirmed Tuesday.',
  summaryState: 'ready',
  lastSubject: 'Interview',
  lastMessageAt: '2026-09-13T09:00:00.000Z',
  messageCount: 2,
}

describe('InboxResponseSchema', () => {
  it('accepts the full Worker payload', () => {
    const parsed = InboxResponseSchema.parse({
      threads: [thread],
      nextCursor: 'abc',
    })
    expect(parsed.threads[0]).toEqual(thread)
    expect(parsed.nextCursor).toBe('abc')
  })

  it('survives an older Worker that omits the optional fields', () => {
    const { summaryState, lastSubject, ...older } = thread
    void summaryState
    void lastSubject
    const parsed = InboxResponseSchema.parse({ threads: [older] })

    expect(parsed.nextCursor).toBeNull()
    expect(parsed.threads[0]).toMatchObject({
      summaryState: 'pending',
      lastSubject: null,
    })
  })

  it('rejects an unknown status rather than rendering an unstyled pill', () => {
    expect(() =>
      InboxResponseSchema.parse({
        threads: [{ ...thread, status: 'ghosted' }],
        nextCursor: null,
      }),
    ).toThrow()
  })
})
