import { THREADS } from '../../_data/inbox'
import type { InboxFilter, Thread } from '../../_lib/types'
import { Logo } from '../Logo'
import { StatusPill } from '../StatusPill'

const FILTERS: { key: InboxFilter; label: string; count?: number }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread', count: 4 },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'offers', label: 'Offers' },
]

export function ThreadList({
  activeThread,
  onSelectThread,
  filter,
  onChangeFilter,
}: {
  activeThread: string
  onSelectThread: (id: string) => void
  filter: InboxFilter
  onChangeFilter: (f: InboxFilter) => void
}) {
  return (
    <div className="thread-list">
      <ThreadFilters filter={filter} onChangeFilter={onChangeFilter} />
      <div className="thread-scroller">
        {THREADS.map((t) => (
          <ThreadRow
            key={t.id}
            thread={t}
            active={activeThread === t.id}
            onClick={() => onSelectThread(t.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ThreadFilters({
  filter,
  onChangeFilter,
}: {
  filter: InboxFilter
  onChangeFilter: (f: InboxFilter) => void
}) {
  return (
    <div className="thread-filters">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          className={`filter-btn ${filter === f.key ? 'active' : ''}`}
          onClick={() => onChangeFilter(f.key)}
        >
          {f.label}
          {f.count !== undefined && (
            <span
              style={{
                fontFamily: 'var(--f-mono)',
                fontSize: 10,
                opacity: 0.6,
                marginLeft: 4,
              }}
            >
              {f.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function ThreadRow({
  thread,
  active,
  onClick,
}: {
  thread: Thread
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`thread${active ? ' active' : ''}${thread.unread ? ' unread' : ''}`}
      onClick={onClick}
    >
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
    </button>
  )
}
