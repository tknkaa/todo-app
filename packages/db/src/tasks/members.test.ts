import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, insertUser } from '../testing/d1'
import { D1TaskMemberRepository } from './members'
import { D1TaskRepository } from './repository'

describe('task sharing', () => {
  let database: ReturnType<typeof createTestDatabase>
  let tasks: D1TaskRepository
  let members: D1TaskMemberRepository

  beforeEach(async () => {
    database = createTestDatabase()
    tasks = new D1TaskRepository(database)
    members = new D1TaskMemberRepository(database)
    for (const id of ['alice', 'bob', 'carol']) await insertUser(database, id)
    await tasks.create({
      id: 't1',
      userId: 'alice',
      title: 'one',
      status: 'todo',
      dueAt: null,
      completedAt: null,
      remindBeforeMinutes: null,
    })
  })

  it('shows a shared task to its member but not to others', async () => {
    await members.addByEmail('t1', 'bob@example.com')

    expect((await tasks.listByUser('bob')).map((t) => t.id)).toEqual(['t1'])
    expect(await tasks.findAccessible('bob', 't1')).toMatchObject({ id: 't1', userId: 'alice' })
    expect(await tasks.listByUser('carol')).toEqual([])
    expect(await tasks.findAccessible('carol', 't1')).toBeNull()
  })

  it('lets a member edit and move the task, but not delete or own it', async () => {
    await members.addByEmail('t1', 'bob@example.com')

    await tasks.update('bob', 't1', { title: 'renamed' })
    await tasks.setStatus('bob', 't1', 'done', '2030-01-01T00:00:00.000Z')
    expect(await tasks.findAccessible('alice', 't1')).toMatchObject({
      title: 'renamed',
      status: 'done',
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
      status: 'todo',
    })
  })

  it('keeps concurrent edits of different fields', async () => {
    await members.addByEmail('t1', 'bob@example.com')

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

  describe('by email', () => {
    it('makes someone with an account a member right away', async () => {
      expect(await members.addByEmail('t1', 'bob@example.com')).toEqual({
        added: true,
        registered: true,
      })
      expect(await members.listEmails('t1')).toEqual(['bob@example.com'])
      expect((await tasks.listByUser('bob')).length).toBe(1)
    })

    it('invites an address without an account', async () => {
      expect(await members.addByEmail('t1', 'new@example.com')).toEqual({
        added: true,
        registered: false,
      })
      expect(await members.listEmails('t1')).toEqual(['new@example.com'])
    })

    it('lists members and invited addresses together, in the order they were added', async () => {
      await members.addByEmail('t1', 'new@example.com')
      await members.addByEmail('t1', 'bob@example.com')
      expect((await members.listEmails('t1')).sort()).toEqual([
        'bob@example.com',
        'new@example.com',
      ])
    })

    it('adds an address only once', async () => {
      await members.addByEmail('t1', 'bob@example.com')
      await members.addByEmail('t1', 'new@example.com')

      expect((await members.addByEmail('t1', 'bob@example.com')).added).toBe(false)
      expect((await members.addByEmail('t1', 'new@example.com')).added).toBe(false)
      expect(await members.listEmails('t1')).toHaveLength(2)
    })

    it('stops sharing with a member or an invited address', async () => {
      await members.addByEmail('t1', 'bob@example.com')
      await members.addByEmail('t1', 'new@example.com')

      await members.removeByEmail('t1', 'bob@example.com')
      await members.removeByEmail('t1', 'new@example.com')

      expect(await members.listEmails('t1')).toEqual([])
      expect(await tasks.listByUser('bob')).toEqual([])
    })

    it('turns invitations into memberships when the person signs up', async () => {
      await members.addByEmail('t1', 'newcomer@example.com')
      await insertUser(database, 'newcomer')

      expect(await members.acceptInvites('newcomer', 'newcomer@example.com')).toBe(1)
      expect((await tasks.listByUser('newcomer')).map((t) => t.id)).toEqual(['t1'])
      expect(await members.listEmails('t1')).toEqual(['newcomer@example.com'])
      expect(await members.acceptInvites('newcomer', 'newcomer@example.com')).toBe(0)
    })

    it('ignores invitations meant for other addresses', async () => {
      await members.addByEmail('t1', 'someone@example.com')
      expect(await members.acceptInvites('bob', 'bob@example.com')).toBe(0)
      expect(await tasks.listByUser('bob')).toEqual([])
    })

    it('finds the email of a user', async () => {
      expect(await members.emailOf('bob')).toBe('bob@example.com')
      expect(await members.emailOf('nobody')).toBeNull()
    })
  })

  it('lists the owner and members as the people to notify', async () => {
    await members.addByEmail('t1', 'bob@example.com')
    expect((await members.accessUserIds('t1')).sort()).toEqual(['alice', 'bob'])
    expect(await members.accessUserIds('missing')).toEqual([])
  })

  it('removes memberships and invitations when the task is deleted', async () => {
    await members.addByEmail('t1', 'bob@example.com')
    await members.addByEmail('t1', 'new@example.com')
    await tasks.delete('alice', 't1')
    expect(await members.listEmails('t1')).toEqual([])
  })
})
