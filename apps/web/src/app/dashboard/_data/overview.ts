import type { FunnelStep, RecentActivity, Stat } from '../_lib/types'

export const STATS: Stat[] = [
  {
    label: 'Applications',
    value: '47',
    unit: 'apps',
    trend: '↑ 6 this week',
  },
  {
    label: 'In conversation',
    value: '11',
    unit: null,
    trend: '↑ 2 this week',
  },
  {
    label: 'Response rate',
    value: '28',
    unit: '%',
  },
  {
    label: 'Offers',
    value: '3',
    unit: null,
    trend: '2 active · 1 declined',
  },
]

export const FUNNEL: FunnelStep[] = [
  { label: 'Applied', w: 100, n: 47 },
  { label: 'Replied', w: 51, n: 24 },
  { label: 'Interviewing', w: 28, n: 13 },
  { label: 'Final round', w: 17, n: 8 },
  { label: 'Offer', w: 6, n: 3 },
]

export const RECENT: RecentActivity[] = [
  {
    logo: 'N',
    role: 'Senior Product Designer',
    co: 'Northwind Design',
    status: 'interview',
    label: 'Interview scheduled',
    when: '2h ago',
  },
  {
    logo: '✦',
    role: 'Design Engineer',
    co: 'Fieldnote',
    status: 'offer',
    label: 'Offer extended',
    when: 'Sat · 10:12 AM',
  },
  {
    logo: '◎',
    role: 'Product Manager, Growth',
    co: 'Lumen Labs',
    status: 'replied',
    label: 'Recruiter replied',
    when: 'Apr 18',
  },
  {
    logo: 'H',
    role: 'Senior UX Researcher',
    co: 'Harbor',
    status: 'applied',
    label: 'Application confirmed',
    when: 'Apr 16',
  },
  {
    logo: 'R',
    role: 'Product Designer II',
    co: 'Relay',
    status: 'rejected',
    label: 'Closed · not moving forward',
    when: 'Apr 15',
  },
]
