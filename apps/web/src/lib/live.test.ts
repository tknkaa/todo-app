import { describe, expect, it } from 'vitest'
import { isTasksChanged, reconnectDelay } from './live'

describe('reconnectDelay', () => {
  it.each([
    [0, 1000],
    [1, 2000],
    [3, 8000],
    [5, 30_000],
    [50, 30_000],
    [-1, 1000],
  ])('attempt %i waits %i ms', (attempt, delay) => {
    expect(reconnectDelay(attempt)).toBe(delay)
  })
})

describe('isTasksChanged', () => {
  it('recognizes the change notification', () => {
    expect(isTasksChanged('{"type":"tasks.changed"}')).toBe(true)
  })

  it.each(['pong', '{"type":"other"}', '[]', 'null', '{', 42, null])('ignores %j', (data) => {
    expect(isTasksChanged(data)).toBe(false)
  })
})
