import { RECENT } from '../../_data/overview'
import { Logo } from '../Logo'
import { StatusPill } from '../StatusPill'

export function RecentActivityCard() {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Recent activity</h3>
        <span className="meta">auto-detected from Gmail</span>
      </div>
      <div className="recent-list">
        {RECENT.map((r, i) => (
          <div key={i} className="recent-row">
            <Logo size="sm">{r.logo}</Logo>
            <div>
              <div className="role">{r.role}</div>
              <div className="co">{r.co}</div>
            </div>
            <StatusPill status={r.status}>{r.label}</StatusPill>
            <span className="when">{r.when}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
