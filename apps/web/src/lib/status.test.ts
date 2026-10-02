import { describe, expect, it } from 'vitest'
import type { Task } from '@todo/db'
import { groupByStatus, isTaskStatus, moveTask, statusChange } from './status'

const task = (id: string, status: Task['status']): Task => ({
  id,
  userId: 'u',
  title: id,
  status,
  dueAt: null,
  completedAt: status === 'done' ? '2030-01-01T00:00:00.000Z' : null,
  remindBeforeMinutes: null,
})

const now = new Date('2026-10-02T01:02:03.000Z')

describe('isTaskStatus', () => {
  it.each(['todo', 'doing', 'done'])('accepts %s', (value) => {
    expect(isTaskStatus(value)).toBe(true)
  })

  it.each(['', 'DONE', 'completed', null, 1])('rejects %j', (value) => {
    expect(isTaskStatus(value)).toBe(false)
  })
})

describe('statusChange', () => {
  it('sets the completion time only for done', () => {
    expect(statusChange('done', now)).toEqual({
      status: 'done',
      completedAt: '2026-10-02T01:02:03.000Z',
    })
    expect(statusChange('doing', now)).toEqual({ status: 'doing', completedAt: null })
    expect(statusChange('todo', now)).toEqual({ status: 'todo', completedAt: null })
  })
})

describe('groupByStatus', () => {
  it('splits tasks into columns and keeps their order', () => {
    const columns = groupByStatus([
      task('a', 'done'),
      task('b', 'todo'),
      task('c', 'todo'),
      task('d', 'doing'),
    ])
    expect(columns.todo.map((t) => t.id)).toEqual(['b', 'c'])
    expect(columns.doing.map((t) => t.id)).toEqual(['d'])
    expect(columns.done.map((t) => t.id)).toEqual(['a'])
  })

  it('returns three empty columns for no tasks', () => {
    expect(groupByStatus([])).toEqual({ todo: [], doing: [], done: [] })
  })
})

describe('moveTask', () => {
  it('moves only the given task and updates its completion time', () => {
    const moved = moveTask([task('a', 'todo'), task('b', 'todo')], 'a', 'done', now)
    expect(moved[0]).toMatchObject({ status: 'done', completedAt: '2026-10-02T01:02:03.000Z' })
    expect(moved[1]).toMatchObject({ status: 'todo', completedAt: null })
  })

  it('clears the completion time when moving out of done', () => {
    const moved = moveTask([task('a', 'done')], 'a', 'doing', now)
    expect(moved[0]).toMatchObject({ status: 'doing', completedAt: null })
  })

  it('leaves the list unchanged for an unknown id', () => {
    const tasks = [task('a', 'todo')]
    expect(moveTask(tasks, 'x', 'done', now)).toEqual(tasks)
  })
})
