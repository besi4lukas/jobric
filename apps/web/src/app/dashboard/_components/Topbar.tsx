export function Topbar({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="topbar">
      <div className="page-title">
        <h1>{title}</h1>
        <span className="sub">{subtitle}</span>
      </div>
      <div className="top-actions">
        <div className="search">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input placeholder="Search companies, roles, emails…" />
          <span
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: 11,
              color: 'var(--ink-mute)',
            }}
          >
            ⌘K
          </span>
        </div>
        <span className="sync-badge">
          <span className="pulse"></span> Synced · 2m ago
        </span>
      </div>
    </div>
  )
}
