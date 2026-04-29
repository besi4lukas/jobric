import { Switch } from '../Switch'

export function WeeklyDigestCard({
  userEmail,
  on,
  onToggle,
}: {
  userEmail: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Weekly digest</h3>
        <span className="meta">Sunday 8 PM</span>
      </div>
      <p>A single calm email. Nothing in between.</p>
      <div className="digest-row">
        <span className="l">Last sent</span>
        <span className="v">Apr 20 · opened</span>
      </div>
      <div className="digest-row">
        <span className="l">Next</span>
        <span className="v">Apr 27</span>
      </div>
      <div className="digest-row">
        <span className="l">Delivery</span>
        <span className="v">{userEmail}</span>
      </div>
      <div className="quiet-toggle">
        <span>Send weekly digest</span>
        <Switch on={on} onToggle={onToggle} />
      </div>
    </div>
  )
}
