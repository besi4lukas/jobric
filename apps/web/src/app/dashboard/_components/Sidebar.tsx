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

const ICON_TIMELINE = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M4 12h16" />
    <circle cx="7" cy="12" r="2" />
    <circle cx="17" cy="12" r="2" />
  </svg>
)

const ICON_REMINDERS = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M6 8a6 6 0 0112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
    <path d="M10 20a2 2 0 004 0" />
  </svg>
)

const ICON_PRIVACY = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
  </svg>
)

const ICON_PREFERENCES = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
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
  { view: 'timeline', label: 'Timeline', icon: ICON_TIMELINE },
  { view: 'reminders', label: 'Reminders', icon: ICON_REMINDERS, count: '3' },
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

      <div className="side-label">Settings</div>
      <SideNavItem label="Privacy" icon={ICON_PRIVACY} />
      <SideNavItem label="Preferences" icon={ICON_PREFERENCES} />

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
