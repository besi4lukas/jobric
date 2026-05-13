export type ViewKey = 'overview' | 'inbox' | 'companies'

export type StatusKey =
  | 'applied'
  | 'replied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'final'

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

export type Stat = {
  label: string
  value: string
  unit: string | null
  trend?: string
}

export type FunnelStep = {
  label: string
  w: number
  n: number
}

export type RecentActivity = {
  logo: string
  role: string
  co: string
  status: StatusKey
  label: string
  when: string
}
