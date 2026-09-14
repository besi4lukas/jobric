import { describe, expect, it } from 'vitest'
import { ApplicationsResponseSchema } from '../applications-schema'

const application = {
  id: 'a1',
  company: 'Northwind',
  role: 'Designer',
  requisitionId: 'REQ-42',
  status: 'interviewing',
  statusSource: 'user',
  emailCount: 3,
  lastActivityAt: '2026-09-13T09:00:00.000Z',
  interviewAt: '2026-09-20T15:00:00.000Z',
}

describe('ApplicationsResponseSchema', () => {
  it('accepts the full Worker payload', () => {
    const parsed = ApplicationsResponseSchema.parse({
      applications: [application],
      nextCursor: 'abc',
    })
    expect(parsed.applications[0]).toEqual(application)
    expect(parsed.nextCursor).toBe('abc')
  })

  it('defaults statusSource, interviewAt and nextCursor when omitted', () => {
    const { statusSource, interviewAt, ...older } = application
    void statusSource
    void interviewAt
    const parsed = ApplicationsResponseSchema.parse({
      applications: [older],
    })

    expect(parsed.nextCursor).toBeNull()
    expect(parsed.applications[0]).toMatchObject({
      statusSource: 'gmail',
      interviewAt: null,
    })
  })

  it('rejects an unknown status rather than rendering an unstyled pill', () => {
    expect(() =>
      ApplicationsResponseSchema.parse({
        applications: [{ ...application, status: 'ghosted' }],
        nextCursor: null,
      }),
    ).toThrow()
  })
})
