import { describe, expect, it } from 'vitest'
import { EmailEnvelopeSchema } from '../types'

const base = {
  userId: 'user_1',
  from: 'a@b.com',
  to: 'me@gmail.com',
  subject: 'Hi',
}

describe('EmailEnvelopeSchema', () => {
  it('still accepts the Email Workers shape (no Gmail ids)', () => {
    expect(EmailEnvelopeSchema.parse(base)).toEqual(base)
  })

  it('accepts the cron-path inbox fields', () => {
    const envelope = {
      ...base,
      body: 'snippet as body',
      gmailMessageId: 'msg_1',
      gmailThreadId: 'thr_1',
      snippet: 'snippet as body',
      sentAt: '2026-09-13T09:00:00.000Z',
    }
    expect(EmailEnvelopeSchema.parse(envelope)).toEqual(envelope)
  })

  it('rejects a sentAt that is not an ISO datetime', () => {
    expect(() =>
      EmailEnvelopeSchema.parse({ ...base, sentAt: '1757754000000' }),
    ).toThrow()
  })

  it('rejects empty Gmail ids rather than treating them as present', () => {
    expect(() =>
      EmailEnvelopeSchema.parse({ ...base, gmailThreadId: '' }),
    ).toThrow()
  })
})
