import { describe, expect, it } from 'vitest'
import { formatDueDate } from './format'

describe('formatDueDate', () => {
  it('formats in Japanese month/day and 24h time in the given zone', () => {
    expect(formatDueDate('2026-10-03T00:30:00.000Z', 'Asia/Tokyo')).toBe('10月3日 9:30')
  })

  it('respects the time zone', () => {
    expect(formatDueDate('2026-10-03T00:30:00.000Z', 'UTC')).toBe('10月3日 0:30')
  })
})
