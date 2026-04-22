import { UPCOMING } from '../../_data/overview'

export function UpcomingCard() {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Upcoming</h3>
        <span className="meta">next 7 days</span>
      </div>
      <div className="upcoming-list">
        {UPCOMING.map((u, i) => (
          <div key={i} className="up-item">
            <div className="when">
              <div className="d">{u.d}</div>
              <div className="m">{u.m}</div>
            </div>
            <div>
              <div className="role">{u.role}</div>
              <div className="co">{u.co}</div>
            </div>
            <div className="time">{u.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
