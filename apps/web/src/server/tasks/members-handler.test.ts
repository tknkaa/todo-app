import { beforeEach, describe, expect, it } from 'vitest'
import { D1TaskMemberRepository, D1TaskRepository } from '@todo/db'
import { createTestDatabase, insertUser } from '@todo/db/testing'
import { handleMembersRequest } from './members-handler'

describe('handleMembersRequest', () => {
  let tasks: D1TaskRepository
  let members: D1TaskMemberRepository
  let notified: string[][]

  const call = (method: string, path: string, body?: unknown, userId = 'alice') =>
    handleMembersRequest(
      new Request(`http://localhost${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      {
        tasks,
        members,
        notify: async (userIds) => {
          notified.push([...userIds].sort())
        },
      },
      userId,
    )

  beforeEach(async () => {
    const database = createTestDatabase()
    tasks = new D1TaskRepository(database)
    members = new D1TaskMemberRepository(database)
    notified = []
    for (const id of ['alice', 'bob', 'carol']) await insertUser(database, id)
    await tasks.create({ id: 't1', userId: 'alice', title: 'one', dueAt: null, completedAt: null })
  })

  it('shares a task by email and notifies both people', async () => {
    const response = await call('POST', '/api/tasks/t1/members', { email: 'Bob@example.com' })
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual([{ userId: 'bob', email: 'bob@example.com', name: '' }])
    expect(notified).toEqual([['alice', 'bob']])
  })

  it('is idempotent when the same person is added again', async () => {
    await call('POST', '/api/tasks/t1/members', { email: 'bob@example.com' })
    const again = await call('POST', '/api/tasks/t1/members', { email: 'bob@example.com' })
    expect(((await again.json()) as unknown[]).length).toBe(1)
  })

  it.each([
    [{ email: 'nobody@example.com' }, 404],
    [{ email: 'alice@example.com' }, 400],
    [{ email: 'not-an-email' }, 400],
    [{}, 400],
  ])('rejects %j with %i', async (body, status) => {
    expect((await call('POST', '/api/tasks/t1/members', body)).status).toBe(status)
  })

  it('lets only the owner share', async () => {
    await members.add('t1', 'bob')
    const response = await call(
      'POST',
      '/api/tasks/t1/members',
      { email: 'carol@example.com' },
      'bob',
    )
    expect(response.status).toBe(403)
    expect(await members.listByTask('t1')).toHaveLength(1)
  })

  it('hides the task from people it is not shared with', async () => {
    expect((await call('GET', '/api/tasks/t1/members', undefined, 'carol')).status).toBe(404)
    expect((await call('DELETE', '/api/tasks/t1/members/bob', undefined, 'carol')).status).toBe(404)
  })

  it('lets a member see the member list', async () => {
    await members.add('t1', 'bob')
    const response = await call('GET', '/api/tasks/t1/members', undefined, 'bob')
    expect(response.status).toBe(200)
    expect(((await response.json()) as unknown[]).length).toBe(1)
  })

  it('lets the owner remove a member and notifies the removed person too', async () => {
    await members.add('t1', 'bob')
    notified = []

    expect((await call('DELETE', '/api/tasks/t1/members/bob')).status).toBe(204)
    expect(await members.listByTask('t1')).toEqual([])
    expect(notified).toEqual([['alice', 'bob']])
  })

  it('lets a member leave but not remove someone else', async () => {
    await members.add('t1', 'bob')
    await members.add('t1', 'carol')

    expect((await call('DELETE', '/api/tasks/t1/members/carol', undefined, 'bob')).status).toBe(403)
    expect((await call('DELETE', '/api/tasks/t1/members/bob', undefined, 'bob')).status).toBe(204)
    expect((await members.listByTask('t1')).map((m) => m.userId)).toEqual(['carol'])
  })

  it('answers unknown routes and methods', async () => {
    expect((await call('PUT', '/api/tasks/t1/members')).status).toBe(405)
    expect((await call('GET', '/api/tasks/t1/members/bob')).status).toBe(405)
    expect((await call('GET', '/api/other')).status).toBe(404)
  })
})
