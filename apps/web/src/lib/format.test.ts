import { describe, expect, it } from 'vitest'
import { formatDueDate, toDateTimeLocal } from './format'

describe('formatDueDate', () => {
  it('formats in Japanese month/day and 24h time in the given zone', () => {
    expect(formatDueDate('2026-10-03T00:30:00.000Z', 'Asia/Tokyo')).toBe('10月3日 9:30')
  })

  it('respects the time zone', () => {
    expect(formatDueDate('2026-10-03T00:30:00.000Z', 'UTC')).toBe('10月3日 0:30')
  })
})

describe('toDateTimeLocal', () => {
  it('converts a UTC time to local time with the given offset', () => {
    expect(toDateTimeLocal('2026-10-03T00:30:00.000Z', -540)).toBe('2026-10-03T09:30')
    expect(toDateTimeLocal('2026-10-03T00:30:00.000Z', 300)).toBe('2026-10-02T19:30')
  })

  it('returns an empty string without a deadline', () => {
    expect(toDateTimeLocal(null)).toBe('')
  })
})
