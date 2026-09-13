import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMessage, internalDateToIso } from '../client'

function stubGmailResponse(body: unknown, status = 200) {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('internalDateToIso', () => {
  it('converts epoch-ms strings to ISO-8601', () => {
    expect(internalDateToIso('1757754000000')).toBe('2025-09-13T09:00:00.000Z')
  })

  it('returns null when absent or not numeric', () => {
    expect(internalDateToIso(undefined)).toBeNull()
    expect(internalDateToIso('not-a-number')).toBeNull()
  })
})

describe('getMessage', () => {
  const gmailMessage = {
    id: 'msg_1',
    threadId: 'thr_1',
    snippet: 'Tuesday 2pm works',
    internalDate: '1757754000000',
    sizeEstimate: 4321,
    payload: {
      headers: [
        { name: 'From', value: 'Priya <priya@northwind.com>' },
        { name: 'To', value: 'me@gmail.com' },
        { name: 'subject', value: 'Interview confirmed' },
      ],
    },
  }

  it('requests metadata only and maps thread id, snippet and sentAt', async () => {
    const fetchMock = stubGmailResponse(gmailMessage)

    const message = await getMessage('token', 'msg_1')

    expect(message).toEqual({
      id: 'msg_1',
      threadId: 'thr_1',
      snippet: 'Tuesday 2pm works',
      from: 'Priya <priya@northwind.com>',
      to: 'me@gmail.com',
      subject: 'Interview confirmed',
      sizeEstimate: 4321,
      sentAt: '2025-09-13T09:00:00.000Z',
    })

    // Privacy stance: no body bytes may leave Gmail.
    const [url] = fetchMock.mock.calls[0] as unknown as [URL]
    expect(url.searchParams.get('format')).toBe('metadata')
  })

  it('yields sentAt null (not a throw) when internalDate is missing', async () => {
    const { internalDate: _omitted, ...withoutDate } = gmailMessage
    stubGmailResponse(withoutDate)

    const message = await getMessage('token', 'msg_1')
    expect(message.sentAt).toBeNull()
    expect(message.threadId).toBe('thr_1')
  })

  it('throws on a non-2xx response', async () => {
    stubGmailResponse({ error: 'nope' }, 404)
    await expect(getMessage('token', 'msg_1')).rejects.toThrow(
      'gmail message get failed: status=404',
    )
  })
})
