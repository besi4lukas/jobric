import type { ViewKey } from '../_lib/types'
import { UserMenu } from './UserMenu'

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

// Briefcase: the conventional glyph for job applications. The previous
// divided square read as a generic grid and collided visually with
// ICON_OVERVIEW, which is also a rectangle arrangement, at 16px.
const ICON_APPLICATIONS = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
    <path d="M3 12.5h18" />
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
  { view: 'inbox', label: 'AI Inbox', icon: ICON_INBOX },
  { view: 'applications', label: 'Applications', icon: ICON_APPLICATIONS },
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

      <UserMenu
        userName={userName}
        userEmail={userEmail}
        userInitial={userInitial}
      />
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
