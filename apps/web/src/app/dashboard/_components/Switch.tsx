export function Switch({
  on,
  onToggle,
}: {
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`switch${on ? ' on' : ''}`}
      onClick={onToggle}
    />
  )
}
