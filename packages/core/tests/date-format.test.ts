import { describe, it, expect } from 'vitest'
import { formatDeterministicDate } from '@bdocs/theme-neutral'
import { formatDate } from '@bdocs/theme-neutral'

/**
 * The point of these is that the output cannot depend on the runtime. A
 * mismatch between Node and the browser is a hydration failure, so the tests
 * assert exact strings rather than shapes.
 */
describe('formatDeterministicDate', () => {
  it('pins the locale and the time zone', () => {
    expect(formatDeterministicDate('2026-09-27')).toBe('September 27, 2026')
  })

  it('does not shift the day for a date-only frontmatter value', () => {
    // A date-only value parses as UTC midnight. A zone behind UTC would render
    // the 26th; the pinned zone keeps the 27th everywhere.
    expect(formatDeterministicDate('2026-01-01')).toBe('January 1, 2026')
    expect(formatDeterministicDate('2026-12-31')).toBe('December 31, 2026')
  })

  it('honours an explicit locale and still pins the zone', () => {
    expect(formatDeterministicDate('2026-09-27', { locale: 'es-ES' })).toBe(
      '27 de septiembre de 2026',
    )
  })

  it('supports a short month', () => {
    expect(formatDeterministicDate('2026-09-27', { month: 'short' })).toBe(
      'Sep 27, 2026',
    )
  })

  it('supports a two-digit day', () => {
    expect(
      formatDeterministicDate('2026-09-07', { month: 'short', day: '2-digit' }),
    ).toBe('Sep 07, 2026')
  })

  it('accepts Date and epoch inputs', () => {
    expect(formatDeterministicDate(new Date('2026-09-27T00:00:00Z'))).toBe(
      'September 27, 2026',
    )
    expect(formatDeterministicDate(Date.UTC(2026, 8, 27))).toBe(
      'September 27, 2026',
    )
  })

  it('returns an empty string for missing or invalid values', () => {
    expect(formatDeterministicDate(undefined)).toBe('')
    expect(formatDeterministicDate(null)).toBe('')
    expect(formatDeterministicDate('')).toBe('')
    expect(formatDeterministicDate('not-a-date')).toBe('')
  })
})

describe('formatDate', () => {
  it('is deterministic', () => {
    expect(formatDate('2026-09-27')).toBe('September 27, 2026')
  })

  it('returns an empty string for an invalid date', () => {
    expect(formatDate('nope')).toBe('')
  })

  it('forwards the format options', () => {
    expect(formatDate('2026-09-07', { month: 'short', day: '2-digit' })).toBe(
      'Sep 07, 2026',
    )
  })
})
