import type { ViewKey } from '../_lib/types'

export const TITLES: Record<ViewKey, { h: string; s: string }> = {
  overview: { h: 'Overview', s: '' },
  inbox: { h: 'Inbox', s: '— 4 new, quietly summarized.' },
  companies: { h: 'Companies', s: '— where things stand.' },
}
