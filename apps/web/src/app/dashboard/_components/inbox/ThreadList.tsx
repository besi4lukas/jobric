import { THREADS } from '../../_data/inbox'
import type { Thread } from '../../_lib/types'
import { Logo } from '../Logo'
import { StatusPill } from '../StatusPill'

export function ThreadList() {
  return (
    <div className="thread-list">
      <div className="thread-scroller">
        {THREADS.map((t) => (
          <ThreadRow key={t.id} thread={t} />
        ))}
      </div>
    </div>
  )
}

function ThreadRow({ thread }: { thread: Thread }) {
  return (
    <div className={`thread${thread.unread ? ' unread' : ''}`}>
      <Logo size="sm">{thread.logo}</Logo>
      <div>
        <div className="co">
          <span>{thread.co}</span>
          <span>{thread.when}</span>
        </div>
        <div className="role">{thread.role}</div>
        <div className="summary">{thread.summary}</div>
        <div className="foot">
          <StatusPill status={thread.status}>{thread.statusLabel}</StatusPill>
          <span className="count">
            · {thread.messages} message{thread.messages === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
}
