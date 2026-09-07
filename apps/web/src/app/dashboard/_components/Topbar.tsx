type AccountLabel = {
  email: string
  since: string | null
  checked: string | null
}

export function Topbar({
  title,
  subtitle,
  accountLabel,
}: {
  title: string
  subtitle: string
  accountLabel?: AccountLabel | null
}) {
  return (
    <div className="topbar">
      <div className="page-title">
        <h1>{title}</h1>
        {subtitle && <span className="sub">{subtitle}</span>}
      </div>
      {accountLabel && (
        <div className="topbar-account">
          <span>
            Watching {accountLabel.email}
            {accountLabel.since && <> since {accountLabel.since}</>}
          </span>
          {accountLabel.checked && (
            <span className="checked">checked {accountLabel.checked}</span>
          )}
        </div>
      )}
    </div>
  )
}
