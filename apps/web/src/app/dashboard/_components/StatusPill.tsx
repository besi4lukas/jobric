import type { StatusKey } from '../_lib/types'

export function StatusPill({
  status,
  children,
  style,
}: {
  status: StatusKey
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <span className={`status ${status}`} style={style}>
      {children}
    </span>
  )
}
