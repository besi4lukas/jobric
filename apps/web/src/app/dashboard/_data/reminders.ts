import type { Reminder } from '../_lib/types'

export const REMINDERS: Reminder[] = [
  {
    d: '22',
    m: 'Tue',
    title: 'Northwind technical interview',
    co: '45 min · w/ Priya Menon',
    chip: 'tomorrow',
    pill: '2:00 PM',
    sub: 'in 26 hours',
    urgent: true,
  },
  {
    d: '23',
    m: 'Wed',
    title: 'Follow up on Lumen application',
    co: '2 weeks since first email — gentle nudge',
    chip: 'self-set',
    pill: 'any time',
  },
  {
    d: '25',
    m: 'Fri',
    title: 'Fieldnote final round · panel',
    co: 'Sam, Joon, Rita · 90 min total',
    chip: 'prep suggested',
    pill: '10:30 AM',
    sub: 'in 4 days',
  },
  {
    d: '25',
    m: 'Fri',
    title: 'Anvil take-home due',
    co: 'small systems exercise · ~3-4 hrs',
    chip: 'soft deadline',
    pill: 'EOD',
  },
  {
    d: '03',
    m: 'May',
    title: 'Fieldnote offer decision',
    co: 'Sam asked for a response by this date',
    chip: 'you owe a reply',
    pill: 'by EOW',
  },
]
