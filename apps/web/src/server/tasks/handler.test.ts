import { beforeEach, describe, expect, it } from 'vitest'
import { D1TaskMemberRepository, D1TaskRepository, type Task } from '@todo/db'
import { createTestDatabase, insertUser } from '@todo/db/testing'
import { handleTasksRequest } from './handler'

const now = () => new Date('2026-10-02T01:02:03.000Z')

describe('handleTasksRequest', () => {
  let tasks: D1TaskRepository
  let members: D1TaskMemberRepository
  let notified: string[][]

  const call = (method: string, path: string, body?: unknown, userId = 'alice') =>
    handleTasksRequest(
      new Request(`http://localhost${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      {
        tasks,
        members,
        now,
        notify: async (userIds) => {
          notified.push([...userIds].sort())
        },
      },
      userId,
    )
  const create = async (body: unknown = { title: 'Task' }, userId = 'alice') =>
    (await (await call('POST', '/api/tasks', body, userId)).json()) as Task

  beforeEach(async () => {
    const database = createTestDatabase()
    tasks = new D1TaskRepository(database)
    members = new D1TaskMemberRepository(database)
    notified = []
    await insertUser(database, 'alice')
    await insertUser(database, 'bob')
  })

  it('creates a normalized task and lists it', async () => {
    const created = await call('POST', '/api/tasks', {
      title: '  買い物  ',
      dueAt: '2026-10-03T09:30:00+09:00',
    })
    expect(created.status).toBe(201)
    const task = (await created.json()) as Task
    expect(task).toMatchObject({
      userId: 'alice',
      title: '買い物',
      dueAt: '2026-10-03T00:30:00.000Z',
      completedAt: null,
    })

    const listed = await call('GET', '/api/tasks')
    expect(await listed.json()).toEqual([task])
  })

  it('rejects invalid input without writing', async () => {
    const response = await call('POST', '/api/tasks', { title: '   ' })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'タイトルは1〜200文字で入力してください。' })
    expect(await tasks.listByUser('alice')).toEqual([])
    expect(notified).toEqual([])
  })

  it('rejects a body that is not a JSON object', async () => {
    const response = await call('POST', '/api/tasks', [1, 2])
    expect(response.status).toBe(400)
  })

  it('moves a task between columns and records the completion time', async () => {
    const { id } = await create()

    expect((await call('PATCH', `/api/tasks/${id}`, { status: 'done' })).status).toBe(204)
    expect((await tasks.listByUser('alice'))[0]?.completedAt).toBe('2026-10-02T01:02:03.000Z')

    await call('PATCH', `/api/tasks/${id}`, { status: 'todo' })
    expect((await tasks.listByUser('alice'))[0]?.completedAt).toBeNull()
  })

  it('starts in the todo column and can move to doing without a completion time', async () => {
    const task = await create()
    expect(task.status).toBe('todo')

    await call('PATCH', `/api/tasks/${task.id}`, { status: 'doing' })
    expect(await tasks.findOwned('alice', task.id)).toMatchObject({
      status: 'doing',
      completedAt: null,
    })

    await call('PATCH', `/api/tasks/${task.id}`, { status: 'done' })
    expect(await tasks.findOwned('alice', task.id)).toMatchObject({
      status: 'done',
      completedAt: '2026-10-02T01:02:03.000Z',
    })

    await call('PATCH', `/api/tasks/${task.id}`, { status: 'doing' })
    expect((await tasks.findOwned('alice', task.id))?.completedAt).toBeNull()
  })

  it('keeps the first completion time when moved to done again', async () => {
    const { id } = await create()
    await call('PATCH', `/api/tasks/${id}`, { status: 'done' })
    await call('PATCH', `/api/tasks/${id}`, { status: 'done' })
    expect((await tasks.findOwned('alice', id))?.completedAt).toBe('2026-10-02T01:02:03.000Z')
  })

  it('edits the title and deadline, and clears the deadline', async () => {
    const { id } = await create({ title: 'Task', dueAt: '2030-01-01T00:00:00.000Z' })

    await call('PATCH', `/api/tasks/${id}`, { title: '  Renamed ' })
    expect(await tasks.findAccessible('alice', id)).toMatchObject({
      title: 'Renamed',
      dueAt: '2030-01-01T00:00:00.000Z',
    })

    await call('PATCH', `/api/tasks/${id}`, { dueAt: null })
    expect((await tasks.findAccessible('alice', id))?.dueAt).toBeNull()
  })

  it('validates updates', async () => {
    const { id } = await create()
    expect((await call('PATCH', `/api/tasks/${id}`, { status: 'finished' })).status).toBe(400)
    expect((await call('PATCH', `/api/tasks/${id}`, {})).status).toBe(400)
    expect((await call('PATCH', `/api/tasks/${id}`, { title: ' ' })).status).toBe(400)
  })

  it('answers 404 when another user changes or deletes a task', async () => {
    const { id } = await create()

    expect((await call('PATCH', `/api/tasks/${id}`, { status: 'done' }, 'bob')).status).toBe(404)
    expect((await call('DELETE', `/api/tasks/${id}`, undefined, 'bob')).status).toBe(404)
    expect((await tasks.listByUser('alice'))[0]?.completedAt).toBeNull()
  })

  it('deletes the owner’s task', async () => {
    const { id } = await create()
    expect((await call('DELETE', `/api/tasks/${id}`)).status).toBe(204)
    expect(await tasks.listByUser('alice')).toEqual([])
  })

  it('lets a member edit a shared task but not delete it', async () => {
    const { id } = await create()
    await members.add(id, 'bob')

    expect(
      ((await (await call('GET', '/api/tasks', undefined, 'bob')).json()) as Task[]).length,
    ).toBe(1)
    expect((await call('PATCH', `/api/tasks/${id}`, { title: 'By Bob' }, 'bob')).status).toBe(204)
    expect((await tasks.findAccessible('alice', id))?.title).toBe('By Bob')
    expect((await call('DELETE', `/api/tasks/${id}`, undefined, 'bob')).status).toBe(404)
  })

  it('notifies everyone who can see the task about changes', async () => {
    const { id } = await create()
    await members.add(id, 'bob')
    notified = []

    await call('PATCH', `/api/tasks/${id}`, { status: 'done' }, 'bob')
    await call('DELETE', `/api/tasks/${id}`)

    expect(notified).toEqual([
      ['alice', 'bob'],
      ['alice', 'bob'],
    ])
  })

  it('returns a single task to its owner and to a member, but not to others', async () => {
    const { id } = await create({ title: 'Task', dueAt: '2030-01-01T00:00:00.000Z' })

    const owner = await call('GET', `/api/tasks/${id}`)
    expect(owner.status).toBe(200)
    expect(await owner.json()).toMatchObject({ id, userId: 'alice', title: 'Task' })

    expect((await call('GET', `/api/tasks/${id}`, undefined, 'bob')).status).toBe(404)

    await members.add(id, 'bob')
    expect((await call('GET', `/api/tasks/${id}`, undefined, 'bob')).status).toBe(200)
  })

  it('answers 404 for a task that does not exist', async () => {
    expect((await call('GET', '/api/tasks/missing')).status).toBe(404)
  })

  it('answers unknown routes and methods', async () => {
    expect((await call('PUT', '/api/tasks')).status).toBe(405)
    expect((await call('PUT', '/api/tasks/x')).status).toBe(405)
    expect((await call('GET', '/api/other')).status).toBe(404)
  })

  describe('reminder setting', () => {
    const due = '2030-01-02T00:00:00.000Z'

    it('is off by default', async () => {
      const task = await create({ title: 'Task', dueAt: due })
      expect(task.remindBeforeMinutes).toBeNull()
    })

    it('can be set when creating a task with a deadline', async () => {
      const task = await create({ title: 'Task', dueAt: due, remindBeforeMinutes: 1440 })
      expect(task.remindBeforeMinutes).toBe(1440)
    })

    it('needs a deadline', async () => {
      const response = await call('POST', '/api/tasks', { title: 'Task', remindBeforeMinutes: 60 })
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'リマインドを設定するには締め切りが必要です。',
      })
    })

    it('can be turned on and off', async () => {
      const { id } = await create({ title: 'Task', dueAt: due })

      await call('PATCH', `/api/tasks/${id}`, { remindBeforeMinutes: 1440 })
      expect((await tasks.findOwned('alice', id))?.remindBeforeMinutes).toBe(1440)

      await call('PATCH', `/api/tasks/${id}`, { remindBeforeMinutes: null })
      expect((await tasks.findOwned('alice', id))?.remindBeforeMinutes).toBeNull()
    })

    it('rejects turning it on for a task without a deadline', async () => {
      const { id } = await create()
      const response = await call('PATCH', `/api/tasks/${id}`, { remindBeforeMinutes: 60 })
      expect(response.status).toBe(400)
    })

    it('turns off when the deadline is cleared and survives a deadline change', async () => {
      const { id } = await create({ title: 'Task', dueAt: due, remindBeforeMinutes: 60 })

      await call('PATCH', `/api/tasks/${id}`, { dueAt: '2030-03-01T00:00:00.000Z' })
      expect(await tasks.findOwned('alice', id)).toMatchObject({
        dueAt: '2030-03-01T00:00:00.000Z',
        remindBeforeMinutes: 60,
      })

      await call('PATCH', `/api/tasks/${id}`, { dueAt: null })
      expect(await tasks.findOwned('alice', id)).toMatchObject({
        dueAt: null,
        remindBeforeMinutes: null,
      })
    })

    it('can be changed only by the owner', async () => {
      const { id } = await create({ title: 'Task', dueAt: due })
      await members.add(id, 'bob')

      const response = await call('PATCH', `/api/tasks/${id}`, { remindBeforeMinutes: 60 }, 'bob')
      expect(response.status).toBe(403)
      expect((await tasks.findOwned('alice', id))?.remindBeforeMinutes).toBeNull()
    })
  })
})
