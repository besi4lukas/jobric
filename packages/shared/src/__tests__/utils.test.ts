import { describe, it, expect } from 'vitest'
import { formatJobTitle } from '../utils'

describe('formatJobTitle', () => {
  it('trims whitespace from both ends', () => {
    expect(formatJobTitle('  Engineer  ')).toBe('Engineer')
  })

  it('collapses multiple spaces into one', () => {
    expect(formatJobTitle('Senior   Software   Engineer')).toBe(
      'Senior Software Engineer',
    )
  })

  it('returns an empty string when given only spaces', () => {
    expect(formatJobTitle('   ')).toBe('')
  })
})
