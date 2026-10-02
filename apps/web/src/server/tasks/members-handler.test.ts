import { beforeEach, describe, expect, it } from 'vitest'
import { D1TaskMemberRepository, D1TaskRepository, type NotificationMessage } from '@todo/db'
import { createTestDatabase, insertUser } from '@todo/db/testing'
import { handleMembersRequest } from './members-handler'

describe('handleMembersRequest', () => {
  let database: ReturnType<typeof createTestDatabase>
  let tasks: D1TaskRepository
  let members: D1TaskMemberRepository
  let notified: string[][]
  let mails: NotificationMessage[]

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
        sendMail: async (message) => {
          mails.push(message)
        },
      },
      userId,
    )
  const share = (email: string, userId = 'alice') =>
    call('POST', '/api/tasks/t1/members', { email }, userId)

  beforeEach(async () => {
    database = createTestDatabase()
    tasks = new D1TaskRepository(database)
    members = new D1TaskMemberRepository(database)
    notified = []
    mails = []
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

  it('shares a task by email and notifies both people', async () => {
    const response = await share('Bob@example.com')
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual([{ email: 'bob@example.com' }])
    expect(notified).toEqual([['alice', 'bob']])
  })

  it('answers the same way whether or not the address has an account', async () => {
    const registered = await share('bob@example.com')
    const unregistered = await share('nobody@example.com')

    expect(unregistered.status).toBe(registered.status)
    expect(await unregistered.json()).toEqual([
      { email: 'bob@example.com' },
      { email: 'nobody@example.com' },
    ])
  })

  it('lets an invited person see the task after they sign up', async () => {
    await share('newcomer@example.com')
    await insertUser(database, 'newcomer')
    await members.acceptInvites('newcomer', 'newcomer@example.com')

    expect((await tasks.listByUser('newcomer')).map((t) => t.id)).toEqual(['t1'])
  })

  it('queues one mail for a new share, worded for the person’s situation', async () => {
    await share('bob@example.com')
    await share('nobody@example.com')

    expect(mails).toEqual([
      {
        type: 'task-shared',
        to: 'bob@example.com',
        sharedBy: 'alice@example.com',
        taskId: 't1',
        taskTitle: 'one',
        registered: true,
      },
      {
        type: 'task-shared',
        to: 'nobody@example.com',
        sharedBy: 'alice@example.com',
        taskId: 't1',
        taskTitle: 'one',
        registered: false,
      },
    ])
  })

  it('does not mail or notify again when the address is already shared with', async () => {
    await share('bob@example.com')
    await share('nobody@example.com')
    mails = []
    notified = []

    await share('bob@example.com')
    await share('nobody@example.com')

    expect(mails).toEqual([])
    expect(notified).toEqual([])
  })

  it.each([
    [{ email: 'alice@example.com' }, 400],
    [{ email: 'not-an-email' }, 400],
    [{}, 400],
  ])('rejects %j with %i', async (body, status) => {
    expect((await call('POST', '/api/tasks/t1/members', body)).status).toBe(status)
    expect(mails).toEqual([])
  })

  it('lets only the owner share', async () => {
    await members.addByEmail('t1', 'bob@example.com')

    expect((await share('carol@example.com', 'bob')).status).toBe(403)
    expect(await members.listEmails('t1')).toEqual(['bob@example.com'])
    expect(mails).toEqual([])
  })

  it('hides the task from people it is not shared with', async () => {
    expect((await call('GET', '/api/tasks/t1/members', undefined, 'carol')).status).toBe(404)
    expect(
      (await call('DELETE', '/api/tasks/t1/members/bob%40example.com', undefined, 'carol')).status,
    ).toBe(404)
  })

  it('lets a member see who the task is shared with', async () => {
    await members.addByEmail('t1', 'bob@example.com')
    const response = await call('GET', '/api/tasks/t1/members', undefined, 'bob')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([{ email: 'bob@example.com' }])
  })

  it('lets the owner remove a member or an invitation, and notifies the removed person', async () => {
    await members.addByEmail('t1', 'bob@example.com')
    await members.addByEmail('t1', 'nobody@example.com')
    notified = []

    expect((await call('DELETE', '/api/tasks/t1/members/bob%40example.com')).status).toBe(204)
    expect((await call('DELETE', '/api/tasks/t1/members/nobody%40example.com')).status).toBe(204)

    expect(await members.listEmails('t1')).toEqual([])
    expect(notified[0]).toEqual(['alice', 'bob'])
  })

  it('lets a member leave but not remove someone else', async () => {
    await members.addByEmail('t1', 'bob@example.com')
    await members.addByEmail('t1', 'carol@example.com')

    expect(
      (await call('DELETE', '/api/tasks/t1/members/carol%40example.com', undefined, 'bob')).status,
    ).toBe(403)
    expect(
      (await call('DELETE', '/api/tasks/t1/members/bob%40example.com', undefined, 'bob')).status,
    ).toBe(204)
    expect(await members.listEmails('t1')).toEqual(['carol@example.com'])
  })

  it('answers unknown routes and methods', async () => {
    expect((await call('PUT', '/api/tasks/t1/members')).status).toBe(405)
    expect((await call('GET', '/api/tasks/t1/members/bob%40example.com')).status).toBe(405)
    expect((await call('GET', '/api/other')).status).toBe(404)
  })
})
