import type {
  TimelineEvent as TimelineEventType,
  TimelineMonth as TimelineMonthType,
} from '../../_lib/types'

export function TimelineMonth({ month }: { month: TimelineMonthType }) {
  return (
    <div className="tl-month">
      <div className="tl-month-label">
        {month.label} <span className="yr">{month.year}</span>
      </div>
      {month.events.map((e, i) => (
        <TimelineEvent key={i} event={e} />
      ))}
    </div>
  )
}

function TimelineEvent({ event }: { event: TimelineEventType }) {
  return (
    <div className={`tl-event ${event.kind}`}>
      <div className="main">
        <h5>{event.title}</h5>
        <div className="note">{event.note}</div>
      </div>
      <div className="date">{event.date}</div>
    </div>
  )
}
