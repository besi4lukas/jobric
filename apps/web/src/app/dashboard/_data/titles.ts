import type { ViewKey } from '../_lib/types'

export const TITLES: Record<ViewKey, { h: string; s: string }> = {
  overview: { h: 'Overview', s: '— good morning, Mira.' },
  inbox: { h: 'Inbox', s: '— 4 new, quietly summarized.' },
  companies: { h: 'Companies', s: '— where things stand.' },
  timeline: { h: 'Timeline', s: '— the story so far.' },
  reminders: { h: 'Reminders', s: '— nothing pushy, promise.' },
}
