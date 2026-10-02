import { describe, expect, it } from 'vitest'
import type { Task } from '@todo/db'
import { dropPosition, positionBetween } from './order'

const card = (id: string, position: number): Task => ({
  id,
  userId: 'u',
  title: id,
  status: 'todo',
  position,
  dueAt: null,
  completedAt: null,
  remindBeforeMinutes: null,
})

describe('positionBetween', () => {
  it.each([
    [undefined, undefined, 0],
    [undefined, 5, 4],
    [5, undefined, 6],
    [1, 3, 2],
    [-3, -2, -2.5],
  ])('between %j and %j is %j', (previous, next, expected) => {
    expect(positionBetween(previous, next)).toBe(expected)
  })
})

describe('dropPosition', () => {
  const column = [card('a', 1), card('b', 2), card('c', 3)]

  it('goes before the target', () => {
    expect(dropPosition(column, 'x', 'b', 'before')).toBe(1.5)
    expect(dropPosition(column, 'x', 'a', 'before')).toBe(0)
  })

  it('goes after the target', () => {
    expect(dropPosition(column, 'x', 'b', 'after')).toBe(2.5)
    expect(dropPosition(column, 'x', 'c', 'after')).toBe(4)
  })

  it('goes to the end without a target, and to 0 in an empty column', () => {
    expect(dropPosition(column, 'x', null, 'after')).toBe(4)
    expect(dropPosition([], 'x', null, 'after')).toBe(0)
  })

  it('ignores the moving card itself when it is dropped in its own column', () => {
    // Moving a to just before c: it must land between b and c, not between a and c.
    expect(dropPosition(column, 'a', 'c', 'before')).toBe(2.5)
    // Moving c to the end: the end is after b, not after c itself.
    expect(dropPosition(column, 'c', null, 'after')).toBe(3)
  })

  it('falls back to the end when the target is not in the column', () => {
    expect(dropPosition(column, 'x', 'missing', 'before')).toBe(4)
  })

  it('never lands on a neighbour’s position', () => {
    for (const placement of ['before', 'after'] as const) {
      for (const target of ['a', 'b', 'c']) {
        const position = dropPosition(column, 'x', target, placement)
        expect(column.some((task) => task.position === position)).toBe(false)
      }
    }
  })
})
