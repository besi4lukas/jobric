import Link from 'next/link'
import type { ViewKey } from '../_lib/types'

const ICON_OVERVIEW = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
)

const ICON_INBOX = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M3 7l9 6 9-6" />
    <rect x="3" y="5" width="18" height="14" rx="2" />
  </svg>
)

const ICON_COMPANIES = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M4 10h16M10 4v16" />
  </svg>
)

const ICON_SETTINGS = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
)

type NavDef = {
  view: ViewKey
  label: string
  icon: React.ReactNode
  count?: string
  showDot?: boolean
}

const PRIMARY_NAV: NavDef[] = [
  { view: 'overview', label: 'Overview', icon: ICON_OVERVIEW },
  {
    view: 'inbox',
    label: 'Inbox',
    icon: ICON_INBOX,
    count: '4',
    showDot: true,
  },
  { view: 'companies', label: 'Companies', icon: ICON_COMPANIES, count: '47' },
]

export function Sidebar({
  view,
  onChangeView,
  userName,
  userEmail,
  userInitial,
}: {
  view: ViewKey
  onChangeView: (v: ViewKey) => void
  userName: string
  userEmail: string
  userInitial: string
}) {
  return (
    <aside className="side">
      <div className="brand">
        <span className="plate">Jobric</span>
      </div>

      <div className="side-label">Your search</div>
      {PRIMARY_NAV.map((item) => (
        <SideNavItem
          key={item.view}
          label={item.label}
          icon={item.icon}
          count={item.count}
          showDot={item.showDot}
          active={view === item.view}
          onClick={() => onChangeView(item.view)}
        />
      ))}

      <Link href="/settings" className="nav-item">
        <span className="ic">{ICON_SETTINGS}</span>
        <span>Settings</span>
      </Link>

      <div className="side-footer">
        <div className="avatar">{userInitial}</div>
        <div className="who">
          {userName}
          <small>{userEmail}</small>
        </div>
      </div>
    </aside>
  )
}

function SideNavItem({
  active,
  onClick,
  label,
  icon,
  count,
  showDot,
}: {
  active?: boolean
  onClick?: () => void
  label: string
  icon: React.ReactNode
  count?: string
  showDot?: boolean
}) {
  return (
    <button
      type="button"
      className={`nav-item${active ? ' active' : ''}`}
      onClick={onClick}
    >
      <span className="ic">{icon}</span>
      <span>{label}</span>
      {count && <span className="count">{count}</span>}
      {showDot && !active && <span className="dot" />}
    </button>
  )
}
