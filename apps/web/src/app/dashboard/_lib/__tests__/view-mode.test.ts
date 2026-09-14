import { describe, expect, it } from 'vitest'
import { parseViewMode } from '../view-mode'

describe('parseViewMode', () => {
  it('recognises grid', () => {
    expect(parseViewMode('grid')).toBe('grid')
  })

  it('falls back to table for anything else', () => {
    expect(parseViewMode('table')).toBe('table')
    expect(parseViewMode('garbage')).toBe('table')
    expect(parseViewMode(null)).toBe('table')
    expect(parseViewMode(undefined)).toBe('table')
  })
})
