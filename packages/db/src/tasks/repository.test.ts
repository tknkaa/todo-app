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
  remindBeforeMinutes: null,
  status: 'todo' as const,
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
    await repository.setStatus('alice', 'done', 'done', '2029-01-01T00:00:00.000Z')

    const tasks = await repository.listByUser('alice')
    expect(tasks.map((t) => t.id)).toEqual(['soon', 'late', 'none', 'done'])
  })

  it('does not let another user change or delete a task', async () => {
    await repository.create(task('a1', 'alice'))

    await repository.setStatus('bob', 'a1', 'done', '2030-01-01T00:00:00.000Z')
    await repository.delete('bob', 'a1')

    const [stored] = await repository.listByUser('alice')
    expect(stored?.completedAt).toBeNull()
  })

  it('deletes and reopens the owner’s tasks', async () => {
    await repository.create(task('a1', 'alice'))
    await repository.setStatus('alice', 'a1', 'done', '2030-01-01T00:00:00.000Z')
    await repository.setStatus('alice', 'a1', 'todo', null)
    expect((await repository.listByUser('alice'))[0]?.completedAt).toBeNull()

    await repository.delete('alice', 'a1')
    expect(await repository.listByUser('alice')).toEqual([])
  })
})

describe('reminders', () => {
  const remindable = (id: string, dueAt: string, remindBeforeMinutes: number | null) => ({
    ...task(id, 'alice', dueAt),
    remindBeforeMinutes,
  })

  async function setup() {
    const database = createTestDatabase()
    const repository = new D1TaskRepository(database)
    await insertUser(database, 'alice')
    return { database, repository }
  }

  it('does not remind tasks that did not ask for a reminder', async () => {
    const { database, repository } = await setup()
    await repository.create(remindable('off', '2030-01-01T00:30:00.000Z', null))

    expect(await findDueReminders(database, '2030-01-01T00:00:00.000Z')).toEqual([])
  })

  it('reminds once the lead time before the deadline has come', async () => {
    const { database, repository } = await setup()
    await repository.create(remindable('day', '2030-01-02T12:00:00.000Z', 24 * 60))

    // 25h before the deadline: too early. Exactly 24h before: due.
    expect(await findDueReminders(database, '2030-01-01T11:00:00.000Z')).toEqual([])
    const due = await findDueReminders(database, '2030-01-01T12:00:00.000Z')
    expect(due.map((r) => r.taskId)).toEqual(['day'])
    expect(due[0]).toMatchObject({ email: 'alice@example.com', title: 'task day' })
  })

  it('respects each task’s own lead time', async () => {
    const { database, repository } = await setup()
    await repository.create(remindable('hour', '2030-01-02T12:00:00.000Z', 60))
    await repository.create(remindable('week', '2030-01-02T12:00:00.000Z', 7 * 24 * 60))

    const now = '2030-01-01T12:00:00.000Z'
    expect((await findDueReminders(database, now)).map((r) => r.taskId)).toEqual(['week'])
  })

  it('skips finished, overdue and already queued tasks', async () => {
    const { database, repository } = await setup()
    await repository.create(remindable('done', '2030-01-01T12:00:00.000Z', 60))
    await repository.setStatus('alice', 'done', 'done', '2030-01-01T01:00:00.000Z')
    await repository.create(remindable('past', '2029-12-31T00:00:00.000Z', 60))
    await repository.create(remindable('queued', '2030-01-01T12:00:00.000Z', 60))

    const now = '2030-01-01T11:30:00.000Z'
    await markReminderQueued(database, 'queued', now)

    expect(await findDueReminders(database, now)).toEqual([])
  })

  it('reminds again after the deadline or the reminder is changed', async () => {
    const { database, repository } = await setup()
    await repository.create(remindable('t', '2030-01-01T12:00:00.000Z', 60))
    const now = '2030-01-01T11:30:00.000Z'
    await markReminderQueued(database, 't', now)
    expect(await findDueReminders(database, now)).toEqual([])

    await repository.update('alice', 't', { dueAt: '2030-01-01T13:00:00.000Z' })
    // The new deadline is 1h30 away, so the 60 min reminder is not due yet...
    expect(await findDueReminders(database, now)).toEqual([])
    // ...but it will be, and it has not been queued for the new deadline.
    expect(
      (await findDueReminders(database, '2030-01-01T12:30:00.000Z')).map((r) => r.taskId),
    ).toEqual(['t'])

    await markReminderQueued(database, 't', '2030-01-01T12:30:00.000Z')
    await repository.update('alice', 't', { remindBeforeMinutes: 120 })
    expect(
      (await findDueReminders(database, '2030-01-01T12:30:00.000Z')).map((r) => r.taskId),
    ).toEqual(['t'])
  })

  it('does not reset the reminder when only the title changes', async () => {
    const { database, repository } = await setup()
    await repository.create(remindable('t', '2030-01-01T12:00:00.000Z', 60))
    const now = '2030-01-01T11:30:00.000Z'
    await markReminderQueued(database, 't', now)

    await repository.update('alice', 't', { title: 'renamed' })
    expect(await findDueReminders(database, now)).toEqual([])
  })

  it('stores and returns the reminder setting', async () => {
    const { repository } = await setup()
    await repository.create(remindable('t', '2030-01-01T12:00:00.000Z', 1440))
    expect((await repository.findOwned('alice', 't'))?.remindBeforeMinutes).toBe(1440)

    await repository.update('alice', 't', { remindBeforeMinutes: null })
    expect((await repository.findOwned('alice', 't'))?.remindBeforeMinutes).toBeNull()
  })
})

describe('status', () => {
  it('moves a task between board columns', async () => {
    const database = createTestDatabase()
    const repository = new D1TaskRepository(database)
    await insertUser(database, 'alice')
    await repository.create(task('a1', 'alice'))
    expect((await repository.findOwned('alice', 'a1'))?.status).toBe('todo')

    await repository.setStatus('alice', 'a1', 'doing', null)
    expect(await repository.findOwned('alice', 'a1')).toMatchObject({
      status: 'doing',
      completedAt: null,
    })

    await repository.setStatus('alice', 'a1', 'done', '2030-01-01T00:00:00.000Z')
    expect(await repository.findOwned('alice', 'a1')).toMatchObject({
      status: 'done',
      completedAt: '2030-01-01T00:00:00.000Z',
    })
  })
})

describe('findOwned', () => {
  it('returns the task only for its owner', async () => {
    const database = createTestDatabase()
    const repository = new D1TaskRepository(database)
    await insertUser(database, 'alice')
    await insertUser(database, 'bob')
    await repository.create(task('a1', 'alice'))

    expect(await repository.findOwned('alice', 'a1')).toMatchObject({ id: 'a1' })
    expect(await repository.findOwned('bob', 'a1')).toBeNull()
    expect(await repository.findOwned('alice', 'missing')).toBeNull()
  })
})
