import { FunnelBar } from './FunnelBar'

type Status = 'applied' | 'interview' | 'offer'

type Activity = {
  logo: string
  role: string
  co: string
  statusLabel: string
  statusClass: Status
  when: string
}

// Illustrative sample data only — see the caption rendered below.
const RECENT_ACTIVITY: Activity[] = [
  {
    logo: 'N',
    role: 'Senior Product Designer',
    co: 'Northwind Design',
    statusLabel: 'Interview',
    statusClass: 'interview',
    when: 'Apr 18',
  },
  {
    logo: '◎',
    role: 'Product Manager, Growth',
    co: 'Lumen Labs',
    statusLabel: 'Applied',
    statusClass: 'applied',
    when: 'Apr 14',
  },
  {
    logo: '✦',
    role: 'Design Engineer',
    co: 'Fieldnote',
    statusLabel: 'Offer',
    statusClass: 'offer',
    when: 'Apr 12',
  },
  {
    logo: 'T',
    role: 'Staff Designer',
    co: 'Thorne & Co',
    statusLabel: 'Applied',
    statusClass: 'applied',
    when: 'Apr 09',
  },
  {
    logo: 'H',
    role: 'Senior UX Researcher',
    co: 'Harbor',
    statusLabel: 'Replied',
    statusClass: 'applied',
    when: 'Apr 07',
  },
  {
    logo: 'R',
    role: 'Product Designer II',
    co: 'Relay',
    statusLabel: 'Interview',
    statusClass: 'interview',
    when: 'Apr 03',
  },
]

export function DashboardPreview() {
  return (
    <section className="section dash-section" id="dashboard">
      <div className="wrap">
        <div className="section-head">
          <div>
            <h2>
              Everything you&apos;ve applied to,{' '}
              <em>without you keeping score</em>.
            </h2>
            <p className="sub">
              A snapshot of your search, the funnel you never had time to build,
              and the next thing you need to do. All in one place.
            </p>
          </div>
        </div>

        <div className="dashboard">
          <div className="dash-top">
            <div className="tabs">
              <span className="active">Overview</span>
              <span>AI Inbox</span>
              <span>Applications</span>
            </div>
          </div>
          <p className="dash-caption">
            Illustrative sample data, not your real activity.
          </p>

          <div className="dash-grid">
            <div className="stats-panel">
              <div className="stats-grid">
                <div className="stat-cell">
                  <div className="big">47</div>
                  <div className="lbl">Applications</div>
                </div>
                <div className="stat-cell">
                  <div className="big">11</div>
                  <div className="lbl">Open Applications</div>
                </div>
                <div className="stat-cell">
                  <div className="big">3</div>
                  <div className="lbl">Interviewing or Better</div>
                </div>
              </div>

              <div className="funnel">
                <h3>Your funnel</h3>
                <FunnelBar label="Applied" value={47} width={100} />
                <FunnelBar label="Replied" value={24} width={51} />
                <FunnelBar label="Interviewing" value={13} width={28} />
                <FunnelBar label="Final round" value={8} width={17} />
                <FunnelBar label="Offer" value={3} width={6} />
              </div>
            </div>

            <div className="pipeline-panel">
              <div className="pipe-head">
                <h3>Recent activity</h3>
                <span className="filter">auto-detected</span>
              </div>
              <div className="pipe-list">
                {RECENT_ACTIVITY.map((item) => (
                  <PipeRow key={`${item.co}-${item.role}`} {...item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PipeRow({ logo, role, co, statusLabel, statusClass, when }: Activity) {
  return (
    <div className="pipe-row">
      <div className="logo">{logo}</div>
      <div>
        <div className="role">{role}</div>
        <div className="co">{co}</div>
      </div>
      <div className={`status ${statusClass}`}>{statusLabel}</div>
      <div className="when">{when}</div>
    </div>
  )
}
