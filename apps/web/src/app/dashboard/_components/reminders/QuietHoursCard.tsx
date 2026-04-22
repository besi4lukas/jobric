import { Switch } from '../Switch'

export function QuietHoursCard({
  on,
  onToggle,
}: {
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Quiet hours</h3>
        <span className="meta">no notifications</span>
      </div>
      <p>Jobric stays quiet while you&apos;re not job-hunting.</p>
      <div className="digest-row">
        <span className="l">Weekdays</span>
        <span className="v">7 PM — 9 AM</span>
      </div>
      <div className="digest-row">
        <span className="l">Weekends</span>
        <span className="v">all day</span>
      </div>
      <div className="quiet-toggle">
        <span>Enforce quiet hours</span>
        <Switch on={on} onToggle={onToggle} />
      </div>
    </div>
  )
}
