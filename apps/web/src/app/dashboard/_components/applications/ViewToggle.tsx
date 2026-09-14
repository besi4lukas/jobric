import type { ViewMode } from '../../_lib/view-mode'

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  return (
    <div className="view-toggle" role="group" aria-label="Layout">
      <button
        type="button"
        aria-pressed={mode === 'table'}
        onClick={() => onChange('table')}
      >
        Table
      </button>
      <button
        type="button"
        aria-pressed={mode === 'grid'}
        onClick={() => onChange('grid')}
      >
        Grid
      </button>
    </div>
  )
}
