export type ViewKey =
  | 'overview'
  | 'inbox'
  | 'companies'
  | 'timeline'
  | 'reminders'

export type StatusKey =
  | 'applied'
  | 'replied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'final'

export type InboxFilter = 'all' | 'unread' | 'interviewing' | 'offers'
export type CompaniesTab = 'all' | 'active' | 'offers' | 'closed' | 'archived'
export type TimelineTab = 'all' | 'applications' | 'interviews' | 'offers'

export type Thread = {
  id: string
  logo: string
  co: string
  when: string
  role: string
  summary: string
  status: StatusKey
  statusLabel: string
  messages: number
  unread: boolean
}

export type ThreadEvent = {
  kind: StatusKey
  when: string
  title: string
  sender: string
  excerpt: string
}

export type ThreadDetail = {
  status: StatusKey
  statusLabel: string
  meta: string
  summary: React.ReactNode
  events: ThreadEvent[]
}

export type Company = {
  logo: string
  name: string
  role: string
  status: StatusKey
  statusLabel: string
  emails: number
  last: string
  when: string
}

export type TimelineEvent = {
  kind: StatusKey
  title: string
  note: string
  date: string
}

export type TimelineMonth = {
  label: string
  year: string
  events: TimelineEvent[]
}

export type Reminder = {
  d: string
  m: string
  title: string
  co: string
  chip: string
  pill: string
  sub?: string
  urgent?: boolean
}

export type Stat = {
  label: string
  value: string
  unit: string | null
  trend: string
  points: string
  stroke: string
}

export type FunnelStep = {
  label: string
  w: number
  n: number
}

export type UpcomingItem = {
  d: string
  m: string
  role: string
  co: string
  time: string
}

export type RecentActivity = {
  logo: string
  role: string
  co: string
  status: StatusKey
  label: string
  when: string
}
