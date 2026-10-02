import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, insertUser } from '../testing/d1'
import { D1AttachmentRepository } from './attachments'
import { D1TaskRepository } from './repository'

const file = (id: string, taskId: string, userId = 'alice') => ({
  id,
  taskId,
  userId,
  filename: `${id}.txt`,
  contentType: 'text/plain',
  size: 3,
  r2Key: `${userId}/${taskId}/${id}`,
})

describe('D1AttachmentRepository', () => {
  let tasks: D1TaskRepository
  let attachments: D1AttachmentRepository

  beforeEach(async () => {
    const database = createTestDatabase()
    tasks = new D1TaskRepository(database)
    attachments = new D1AttachmentRepository(database)
    await insertUser(database, 'alice')
    await insertUser(database, 'bob')
    await tasks.create({
      id: 't1',
      userId: 'alice',
      title: 'one',
      dueAt: null,
      completedAt: null,
      remindBeforeMinutes: null,
      status: 'todo',
    })
  })

  it('creates, lists, counts and finds attachments of a task', async () => {
    await attachments.create(file('a1', 't1'))
    await attachments.create(file('a2', 't1'))

    expect((await attachments.listByTask('alice', 't1')).map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(await attachments.countByTask('alice', 't1')).toBe(2)
    expect(await attachments.find('alice', 'a1')).toMatchObject({ filename: 'a1.txt', size: 3 })
  })

  it('hides attachments from other users', async () => {
    await attachments.create(file('a1', 't1'))

    expect(await attachments.find('bob', 'a1')).toBeNull()
    expect(await attachments.listByTask('bob', 't1')).toEqual([])
    expect(await attachments.countByTask('bob', 't1')).toBe(0)
  })

  it('deletes only the owner’s attachment', async () => {
    await attachments.create(file('a1', 't1'))

    await attachments.delete('bob', 'a1')
    expect(await attachments.find('alice', 'a1')).not.toBeNull()

    await attachments.delete('alice', 'a1')
    expect(await attachments.find('alice', 'a1')).toBeNull()
  })

  it('removes attachments when the task is deleted', async () => {
    await attachments.create(file('a1', 't1'))
    await tasks.delete('alice', 't1')

    expect(await attachments.find('alice', 'a1')).toBeNull()
  })
})
