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
        {subtitle && <span className="sub">{subtitle}</span>}
      </div>
    </div>
  )
}
