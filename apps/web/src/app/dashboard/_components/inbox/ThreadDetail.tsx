import { THREAD_DETAIL } from '../../_data/inbox'
import type { ThreadEvent } from '../../_lib/types'
import { Logo } from '../Logo'
import { StatusPill } from '../StatusPill'

export function ThreadDetail() {
  return (
    <div className="thread-detail">
      <div className="td-head">
        <div className="co-row">
          <Logo size="lg">N</Logo>
          <div style={{ flex: 1 }}>
            <h2>Northwind Design · Senior Product Designer</h2>
            <div className="co-meta">
              <StatusPill
                status={THREAD_DETAIL.status}
                style={{ marginRight: 8 }}
              >
                {THREAD_DETAIL.statusLabel}
              </StatusPill>
              {THREAD_DETAIL.meta}
            </div>
          </div>
          <button className="open-gmail">Open in Gmail ↗</button>
        </div>
        <div className="summary-box">
          <span className="sp">summary —</span>
          <p>{THREAD_DETAIL.summary}</p>
        </div>
      </div>
      <div className="td-body">
        <div className="timeline-thread">
          {THREAD_DETAIL.events.map((e, i) => (
            <TimelineThreadEvent key={i} event={e} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TimelineThreadEvent({ event }: { event: ThreadEvent }) {
  return (
    <div className={`tt-event ${event.kind}`}>
      <div className="when">{event.when}</div>
      <h5>{event.title}</h5>
      <div className="sender">{event.sender}</div>
      <p className="excerpt">{event.excerpt}</p>
    </div>
  )
}
