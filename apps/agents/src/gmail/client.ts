import { z } from 'zod'

// Thin Gmail API wrapper used by the cron poller. Returns plain objects, not
// raw responses — the cron handler shouldn't have to know endpoint shapes.
//
// Scope assumption: caller has gmail.readonly + gmail.metadata. We never call
// any write endpoint, and getMessage uses format=metadata so no body content
// is fetched.

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

// ─── Access token refresh ────────────────────────────────────────────────────

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.literal('Bearer'),
  scope: z.string().optional(),
})

export async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    throw new Error(`gmail token refresh failed: status=${response.status}`)
  }
  const json = TokenResponseSchema.parse(await response.json())
  return json.access_token
}

// ─── History list (paginated) ────────────────────────────────────────────────

const HistoryMessageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
})

const HistoryRecordSchema = z.object({
  id: z.string(),
  messagesAdded: z
    .array(z.object({ message: HistoryMessageSchema }))
    .optional(),
})

const HistoryListResponseSchema = z.object({
  history: z.array(HistoryRecordSchema).optional(),
  nextPageToken: z.string().optional(),
  // Top-level historyId is the new watermark for the next call.
  historyId: z.string().min(1),
})

export type HistoryListResult = {
  messageIds: string[]
  newHistoryId: string
}

// Lists every messageAdded since startHistoryId, paginating until exhausted.
// We deliberately don't filter sent/drafts here — that's a watcher concern,
// keeps this client dumb.
export async function listHistory(
  accessToken: string,
  startHistoryId: string,
): Promise<HistoryListResult> {
  const messageIds: string[] = []
  let pageToken: string | undefined
  let newHistoryId = startHistoryId

  do {
    const url = new URL(`${GMAIL_API_BASE}/history`)
    url.searchParams.set('startHistoryId', startHistoryId)
    url.searchParams.set('historyTypes', 'messageAdded')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      throw new Error(`gmail history list failed: status=${response.status}`)
    }
    const page = HistoryListResponseSchema.parse(await response.json())
    newHistoryId = page.historyId

    for (const record of page.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        messageIds.push(added.message.id)
      }
    }

    pageToken = page.nextPageToken
  } while (pageToken)

  return { messageIds, newHistoryId }
}

// ─── Message metadata fetch ──────────────────────────────────────────────────

const HeaderSchema = z.object({ name: z.string(), value: z.string() })

const MessageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  snippet: z.string().optional(),
  payload: z
    .object({
      headers: z.array(HeaderSchema).optional(),
    })
    .optional(),
  sizeEstimate: z.number().optional(),
})

export type GmailMessageMetadata = {
  id: string
  threadId: string
  snippet: string
  from: string
  to: string
  subject: string
  sizeEstimate: number
}

// format=metadata pulls headers + snippet only. No body bytes leave Gmail.
export async function getMessage(
  accessToken: string,
  messageId: string,
): Promise<GmailMessageMetadata> {
  const url = new URL(`${GMAIL_API_BASE}/messages/${messageId}`)
  url.searchParams.set('format', 'metadata')
  url.searchParams.append('metadataHeaders', 'From')
  url.searchParams.append('metadataHeaders', 'To')
  url.searchParams.append('metadataHeaders', 'Subject')

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`gmail message get failed: status=${response.status}`)
  }
  const message = MessageSchema.parse(await response.json())
  const headers = message.payload?.headers ?? []
  const findHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    ''

  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet ?? '',
    from: findHeader('From'),
    to: findHeader('To'),
    subject: findHeader('Subject'),
    sizeEstimate: message.sizeEstimate ?? 0,
  }
}
