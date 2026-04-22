type LogoSize = 'sm' | 'md' | 'lg'

export function Logo({
  children,
  size = 'md',
}: {
  children: React.ReactNode
  size?: LogoSize
}) {
  const cls = size === 'md' ? 'logo' : `logo ${size}`
  return <div className={cls}>{children}</div>
}
