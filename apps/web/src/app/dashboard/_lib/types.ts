export type ViewKey = 'overview' | 'inbox' | 'applications'

export type StatusKey =
  | 'applied'
  | 'replied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'final'

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
