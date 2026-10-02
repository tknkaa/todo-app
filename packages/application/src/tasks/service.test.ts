import { describe, expect, it, vi } from 'vitest'
import type { Task } from '@todo/domain'
import type { TaskRepository } from './repository'
import { createTask, setTaskCompleted, TaskInputError } from './service'

function createRepository(): TaskRepository & {
  saved: Task[]
  completion: { userId: string; taskId: string; completedAt: string | null }[]
} {
  const saved: Task[] = []
  const completion: { userId: string; taskId: string; completedAt: string | null }[] = []
  return {
    saved,
    completion,
    async listByUser(userId) {
      return saved.filter((task) => task.userId === userId)
    },
    async create(task) {
      saved.push(task)
    },
    async setCompleted(userId, taskId, completedAt) {
      completion.push({ userId, taskId, completedAt })
    },
    async delete(userId, taskId) {
      const index = saved.findIndex((task) => task.userId === userId && task.id === taskId)
      if (index >= 0) saved.splice(index, 1)
    },
  }
}

describe('task application service', () => {
  it('normalizes title and deadline before saving a task', async () => {
    const repository = createRepository()
    const task = await createTask(repository, {
      id: 'task-1',
      userId: 'user-1',
      title: '  Submit report  ',
      dueAt: '2026-10-03T09:30:00+09:00',
    })

    expect(task).toEqual({
      id: 'task-1',
      userId: 'user-1',
      title: 'Submit report',
      dueAt: '2026-10-03T00:30:00.000Z',
      completedAt: null,
    })
    expect(repository.saved).toEqual([task])
  })

  it.each(['', '   '])('rejects an empty title (%j) without writing', async (title) => {
    const repository = createRepository()

    await expect(
      createTask(repository, { id: 'task-1', userId: 'user-1', title, dueAt: null }),
    ).rejects.toBeInstanceOf(TaskInputError)
    expect(repository.saved).toHaveLength(0)
  })

  it('rejects oversized titles and invalid deadlines without writing', async () => {
    const repository = createRepository()

    await expect(
      createTask(repository, {
        id: 'task-1',
        userId: 'user-1',
        title: 't'.repeat(201),
        dueAt: null,
      }),
    ).rejects.toThrow('タイトルは1〜200文字で入力してください。')
    await expect(
      createTask(repository, {
        id: 'task-2',
        userId: 'user-1',
        title: 'Valid',
        dueAt: 'not-a-date',
      }),
    ).rejects.toThrow('締め切りの日時が正しくありません。')
    expect(repository.saved).toHaveLength(0)
  })

  it('records completion timestamps and clears them when reopened', async () => {
    const repository = createRepository()
    const now = vi.fn<() => Date>(() => new Date('2026-10-02T01:02:03.000Z'))

    await setTaskCompleted(repository, 'user-1', 'task-1', true, now)
    await setTaskCompleted(repository, 'user-1', 'task-1', false, now)

    expect(repository.completion).toEqual([
      { userId: 'user-1', taskId: 'task-1', completedAt: '2026-10-02T01:02:03.000Z' },
      { userId: 'user-1', taskId: 'task-1', completedAt: null },
    ])
    expect(now).toHaveBeenCalledOnce()
  })
})
