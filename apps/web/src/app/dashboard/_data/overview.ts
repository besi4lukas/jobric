import type {
  FunnelStep,
  RecentActivity,
  Stat,
  UpcomingItem,
} from '../_lib/types'

export const STATS: Stat[] = [
  {
    label: 'Applications',
    value: '47',
    unit: 'apps',
    trend: '↑ 6 this week',
    points: '0,30 15,28 30,22 45,24 60,16 75,18 90,10 100,8',
    stroke: '#B8542A',
  },
  {
    label: 'In conversation',
    value: '11',
    unit: null,
    trend: '↑ 2 this week',
    points: '0,30 15,32 30,26 45,22 60,24 75,18 90,14 100,12',
    stroke: '#C98A2F',
  },
  {
    label: 'Response rate',
    value: '28',
    unit: '%',
    trend: 'vs. 19% average',
    points: '0,24 15,22 30,20 45,18 60,14 75,16 90,12 100,10',
    stroke: '#4E7A4E',
  },
  {
    label: 'Offers',
    value: '3',
    unit: null,
    trend: '2 active · 1 declined',
    points: '0,38 15,38 30,36 45,36 60,28 75,20 90,18 100,14',
    stroke: '#B8542A',
  },
]

export const FUNNEL: FunnelStep[] = [
  { label: 'Applied', w: 100, n: 47 },
  { label: 'Replied', w: 51, n: 24 },
  { label: 'Interviewing', w: 28, n: 13 },
  { label: 'Final round', w: 17, n: 8 },
  { label: 'Offer', w: 6, n: 3 },
]

export const UPCOMING: UpcomingItem[] = [
  {
    d: '22',
    m: 'Apr',
    role: 'Technical interview · Northwind',
    co: 'with Priya Menon, Eng Director',
    time: '2:00 PM',
  },
  {
    d: '23',
    m: 'Apr',
    role: 'Follow up on Lumen application',
    co: '2 weeks since first email',
    time: 'self · any time',
  },
  {
    d: '25',
    m: 'Apr',
    role: 'Final round · Fieldnote',
    co: 'Panel with Sam, Joon, Rita',
    time: '10:30 AM',
  },
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
