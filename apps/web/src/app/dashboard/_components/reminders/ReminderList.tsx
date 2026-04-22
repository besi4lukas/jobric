import { REMINDERS } from '../../_data/reminders'
import type { Reminder } from '../../_lib/types'

export function ReminderList() {
  return (
    <div>
      <div className="rem-head">
        <h3>Upcoming</h3>
        <span className="meta">3 active</span>
      </div>
      <div className="rem-list">
        {REMINDERS.map((r, i) => (
          <ReminderItem key={i} reminder={r} />
        ))}
      </div>
    </div>
  )
}

function ReminderItem({ reminder }: { reminder: Reminder }) {
  return (
    <div className={`rem-item${reminder.urgent ? ' urgent' : ''}`}>
      <div className="when-block">
        <div className="d">{reminder.d}</div>
        <div className="m">{reminder.m}</div>
      </div>
      <div>
        <h5>{reminder.title}</h5>
        <div className="co">{reminder.co}</div>
        <span className="chip">{reminder.chip}</span>
      </div>
      <div className="actions">
        <span className="time-pill">{reminder.pill}</span>
        {reminder.sub && <small>{reminder.sub}</small>}
      </div>
    </div>
  )
}
