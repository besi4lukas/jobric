import { z } from 'zod'

// Keyset pagination cursor, shared by every list route that pages newest-
// first on a `(sortColumn, id) < (cursor.t, cursor.id)` row-value comparison
// — GET /api/inbox (routes/inbox.ts) and GET /api/applications
// (routes/applications.ts). Extracted here from routes/inbox.ts so a second
// route didn't have to duplicate the codec. Opaque to callers: base64url
// JSON of the last row's sort key.

export type Cursor = { t: string; id: string }

const CursorSchema = z.object({ t: z.string().min(1), id: z.string().min(1) })

export function encodeCursor(cursor: Cursor): string {
  return base64UrlEncode(JSON.stringify(cursor))
}

// null for anything that isn't a cursor we produced — the caller 400s.
export function decodeCursor(value: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(value))
    const result = CursorSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

// Workers and Node both have btoa/atob; TextEncoder round-trips non-ASCII
// (ids are UUIDs and timestamps are ISO, but don't rely on it).
function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
