import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, insertUser } from '../testing/d1'
import { D1TaskMemberRepository } from './members'
import { D1TaskRepository } from './repository'

describe('task sharing', () => {
  let tasks: D1TaskRepository
  let members: D1TaskMemberRepository

  beforeEach(async () => {
    const database = createTestDatabase()
    tasks = new D1TaskRepository(database)
    members = new D1TaskMemberRepository(database)
    for (const id of ['alice', 'bob', 'carol']) await insertUser(database, id)
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

  it('shows a shared task to its member but not to others', async () => {
    await members.add('t1', 'bob')

    expect((await tasks.listByUser('bob')).map((t) => t.id)).toEqual(['t1'])
    expect(await tasks.findAccessible('bob', 't1')).toMatchObject({ id: 't1', userId: 'alice' })
    expect(await tasks.listByUser('carol')).toEqual([])
    expect(await tasks.findAccessible('carol', 't1')).toBeNull()
  })

  it('lets a member edit and complete, but not delete or own', async () => {
    await members.add('t1', 'bob')

    await tasks.update('bob', 't1', { title: 'renamed' })
    await tasks.setStatus('bob', 't1', 'done', '2030-01-01T00:00:00.000Z')
    expect(await tasks.findAccessible('alice', 't1')).toMatchObject({
      title: 'renamed',
      completedAt: '2030-01-01T00:00:00.000Z',
    })

    await tasks.delete('bob', 't1')
    expect(await tasks.findAccessible('alice', 't1')).not.toBeNull()
    expect(await tasks.findOwned('bob', 't1')).toBeNull()
  })

  it('does not let a stranger edit', async () => {
    await tasks.update('carol', 't1', { title: 'hacked' })
    await tasks.setStatus('carol', 't1', 'done', '2030-01-01T00:00:00.000Z')

    expect(await tasks.findAccessible('alice', 't1')).toMatchObject({
      title: 'one',
      completedAt: null,
    })
  })

  it('keeps concurrent edits of different fields', async () => {
    await members.add('t1', 'bob')

    await tasks.update('alice', 't1', { title: 'from alice' })
    await tasks.update('bob', 't1', { dueAt: '2030-01-01T00:00:00.000Z' })

    expect(await tasks.findAccessible('alice', 't1')).toMatchObject({
      title: 'from alice',
      dueAt: '2030-01-01T00:00:00.000Z',
    })
  })

  it('updates nothing when no field is given', async () => {
    await tasks.update('alice', 't1', {})
    expect((await tasks.findAccessible('alice', 't1'))?.title).toBe('one')
  })

  it('adds a member once, lists them and removes them', async () => {
    await members.add('t1', 'bob')
    await members.add('t1', 'bob')

    expect(await members.listByTask('t1')).toEqual([
      { userId: 'bob', email: 'bob@example.com', name: '' },
    ])

    await members.remove('t1', 'bob')
    expect(await members.listByTask('t1')).toEqual([])
    expect(await tasks.listByUser('bob')).toEqual([])
  })

  it('finds users by email', async () => {
    expect(await members.findUserByEmail('bob@example.com')).toEqual({ id: 'bob' })
    expect(await members.findUserByEmail('nobody@example.com')).toBeNull()
  })

  it('lists the owner and members as the people to notify', async () => {
    await members.add('t1', 'bob')
    expect((await members.accessUserIds('t1')).sort()).toEqual(['alice', 'bob'])
    expect(await members.accessUserIds('missing')).toEqual([])
  })

  it('removes memberships when the task is deleted', async () => {
    await members.add('t1', 'bob')
    await tasks.delete('alice', 't1')
    expect(await members.listByTask('t1')).toEqual([])
  })
})
