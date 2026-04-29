import type { Thread, ThreadDetail } from '../_lib/types'

export const THREADS: Thread[] = [
  {
    id: 'northwind',
    logo: 'N',
    co: 'Northwind Design',
    when: '2h ago',
    role: 'Senior Product Designer',
    summary:
      "Priya confirmed your 45-min technical interview for Tuesday 2 PM. She'll cover systems thinking and one case prompt — no prep expected.",
    status: 'interview',
    statusLabel: 'Interview',
    messages: 5,
    unread: true,
  },
  {
    id: 'fieldnote',
    logo: '✦',
    co: 'Fieldnote',
    when: 'Sat',
    role: 'Design Engineer',
    summary:
      'Offer letter attached: $168K base + equity, remote, 4 weeks PTO. Sam hopes to hear back by May 3 — happy to jump on a call with questions.',
    status: 'offer',
    statusLabel: 'Offer',
    messages: 8,
    unread: true,
  },
  {
    id: 'lumen',
    logo: '◎',
    co: 'Lumen Labs',
    when: 'Apr 18',
    role: 'Product Manager, Growth',
    summary:
      "Jordan (recruiter) replied after your follow-up — they're finalizing the role scope this week and will circle back with next steps.",
    status: 'replied',
    statusLabel: 'Replied',
    messages: 3,
    unread: true,
  },
  {
    id: 'harbor',
    logo: 'H',
    co: 'Harbor',
    when: 'Apr 16',
    role: 'Senior UX Researcher',
    summary:
      'Application received — their hiring team reviews rolling, expect to hear within 10 business days. Auto-confirmation only so far.',
    status: 'applied',
    statusLabel: 'Applied',
    messages: 1,
    unread: true,
  },
  {
    id: 'thorne',
    logo: 'T',
    co: 'Thorne & Co',
    when: 'Apr 12',
    role: 'Staff Designer',
    summary:
      'Jean set up a 30-min intro with hiring manager Elena next Thursday. Background covered: remote team, B2B fintech, 8-person design org.',
    status: 'interview',
    statusLabel: 'Interview',
    messages: 4,
    unread: false,
  },
  {
    id: 'relay',
    logo: 'R',
    co: 'Relay',
    when: 'Apr 15',
    role: 'Product Designer II',
    summary:
      'Decided to move forward with another candidate whose background skewed more mobile. Lina left the door open for future roles.',
    status: 'rejected',
    statusLabel: 'Closed',
    messages: 6,
    unread: false,
  },
  {
    id: 'anvil',
    logo: 'A',
    co: 'Anvil',
    when: 'Apr 10',
    role: 'Design Lead',
    summary:
      'Take-home assignment due Friday — small systems exercise, their team said plan for 3–4 hours max, not more.',
    status: 'interview',
    statusLabel: 'Take-home',
    messages: 2,
    unread: false,
  },
  {
    id: 'kindle',
    logo: 'K',
    co: 'Kindle & Co',
    when: 'Apr 07',
    role: 'Senior Designer',
    summary:
      'Recruiter acknowledged referral from Dana — forwarding your resume to the hiring team, will update by end of next week.',
    status: 'replied',
    statusLabel: 'Referred',
    messages: 2,
    unread: false,
  },
]

export const THREAD_DETAIL: ThreadDetail = {
  status: 'interview',
  statusLabel: 'Interview',
  meta: '5 messages · first contact Apr 3 · last reply 2h ago',
  summary: (
    <>
      You applied Apr 3 via their careers page. Priya Menon (Eng Director)
      reached out Apr 10 to set up a recruiter screen, which you had Apr 14. It
      went well — she&apos;s now confirmed a{' '}
      <strong>
        45-minute technical interview for Tuesday Apr 22 at 2:00 PM
      </strong>
      . Format is systems thinking + one case prompt. She noted &quot;no prep
      expected&quot; twice.
    </>
  ),
  events: [
    {
      kind: 'interview',
      when: '2 hours ago · Tue 11:42 AM',
      title: 'Interview confirmed for Tuesday',
      sender: 'from Priya Menon · priya@northwind.co',
      excerpt:
        '"All set — I\'ve put 2 PM on the calendar. Like I said, no prep expected, just come ready to think out loud. Looking forward to it."',
    },
    {
      kind: 'replied',
      when: 'Yesterday · Mon 4:18 PM',
      title: 'You asked about interview format',
      sender: 'to Priya Menon',
      excerpt:
        '"Thanks Priya — Tuesday 2 PM works. Quick q, should I prep anything specific, or is it more of a conversation?"',
    },
    {
      kind: 'replied',
      when: 'Mon · Apr 14 · 2:30 PM',
      title: 'Recruiter screen complete — moving forward',
      sender: 'from Priya Menon',
      excerpt:
        '"Really enjoyed our chat. I\'d like to move you to the next round — a 45-min technical with me. Does Tuesday the 22nd at 2 PM work?"',
    },
    {
      kind: 'applied',
      when: 'Apr 10 · 9:04 AM',
      title: 'Northwind reached out for a recruiter screen',
      sender: 'from Priya Menon',
      excerpt:
        '"Saw your application for the Senior Product Designer role. Would you be open to a 30-min intro this Thursday or Friday?"',
    },
    {
      kind: 'applied',
      when: 'Apr 3 · 11:47 PM',
      title: 'Application submitted',
      sender: 'from careers@northwind.co · auto-confirmation',
      excerpt:
        '"Thanks for applying to Northwind. We review every application and aim to respond within 7 business days."',
    },
  ],
}
