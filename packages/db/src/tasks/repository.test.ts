import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, insertUser } from '../testing/d1'
import { D1TaskRepository } from './repository'
import { findDueReminders, markReminderQueued } from './reminders'

const task = (id: string, userId: string, dueAt: string | null = null) => ({
  id,
  userId,
  title: `task ${id}`,
  dueAt,
  completedAt: null,
})

describe('D1TaskRepository', () => {
  let database: ReturnType<typeof createTestDatabase>
  let repository: D1TaskRepository

  beforeEach(async () => {
    database = createTestDatabase()
    repository = new D1TaskRepository(database)
    await insertUser(database, 'alice')
    await insertUser(database, 'bob')
  })

  it('lists only the given user’s tasks', async () => {
    await repository.create(task('a1', 'alice'))
    await repository.create(task('b1', 'bob'))

    const tasks = await repository.listByUser('alice')
    expect(tasks.map((t) => t.id)).toEqual(['a1'])
  })

  it('orders by completion, then earliest deadline, with no deadline last', async () => {
    await repository.create(task('none', 'alice'))
    await repository.create(task('late', 'alice', '2030-01-02T00:00:00.000Z'))
    await repository.create(task('soon', 'alice', '2030-01-01T00:00:00.000Z'))
    await repository.create(task('done', 'alice', '2029-01-01T00:00:00.000Z'))
    await repository.setCompleted('alice', 'done', '2029-01-01T00:00:00.000Z')

    const tasks = await repository.listByUser('alice')
    expect(tasks.map((t) => t.id)).toEqual(['soon', 'late', 'none', 'done'])
  })

  it('does not let another user change or delete a task', async () => {
    await repository.create(task('a1', 'alice'))

    await repository.setCompleted('bob', 'a1', '2030-01-01T00:00:00.000Z')
    await repository.delete('bob', 'a1')

    const [stored] = await repository.listByUser('alice')
    expect(stored?.completedAt).toBeNull()
  })

  it('deletes and reopens the owner’s tasks', async () => {
    await repository.create(task('a1', 'alice'))
    await repository.setCompleted('alice', 'a1', '2030-01-01T00:00:00.000Z')
    await repository.setCompleted('alice', 'a1', null)
    expect((await repository.listByUser('alice'))[0]?.completedAt).toBeNull()

    await repository.delete('alice', 'a1')
    expect(await repository.listByUser('alice')).toEqual([])
  })
})

describe('reminders', () => {
  it('finds open tasks due in the window once, until they are marked queued', async () => {
    const database = createTestDatabase()
    const repository = new D1TaskRepository(database)
    await insertUser(database, 'alice')
    await repository.create(task('in', 'alice', '2030-01-01T00:30:00.000Z'))
    await repository.create(task('out', 'alice', '2030-01-02T00:00:00.000Z'))
    await repository.create(task('past', 'alice', '2029-12-31T00:00:00.000Z'))
    await repository.create(task('done', 'alice', '2030-01-01T00:10:00.000Z'))
    await repository.setCompleted('alice', 'done', '2030-01-01T00:05:00.000Z')

    const now = '2030-01-01T00:00:00.000Z'
    const until = '2030-01-01T01:00:00.000Z'
    expect((await findDueReminders(database, now, until)).map((r) => r.taskId)).toEqual(['in'])

    await markReminderQueued(database, 'in', now)
    expect(await findDueReminders(database, now, until)).toEqual([])
  })
})
