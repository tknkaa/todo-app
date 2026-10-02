import { beforeEach, describe, expect, it } from 'vitest'
import { D1TaskRepository, type Task } from '@todo/db'
import { createTestDatabase, insertUser } from '@todo/db/testing'
import { handleTasksRequest } from './handler'

const now = () => new Date('2026-10-02T01:02:03.000Z')

describe('handleTasksRequest', () => {
  let repository: D1TaskRepository

  const call = (method: string, path: string, body?: unknown, userId = 'alice') =>
    handleTasksRequest(
      new Request(`http://localhost${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      repository,
      userId,
      now,
    )

  beforeEach(async () => {
    const database = createTestDatabase()
    repository = new D1TaskRepository(database)
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
    expect(await repository.listByUser('alice')).toEqual([])
  })

  it('rejects a body that is not a JSON object', async () => {
    const response = await call('POST', '/api/tasks', [1, 2])
    expect(response.status).toBe(400)
  })

  it('completes and reopens a task with the current time', async () => {
    const { id } = (await (await call('POST', '/api/tasks', { title: 'Task' })).json()) as Task

    expect((await call('PATCH', `/api/tasks/${id}`, { completed: true })).status).toBe(204)
    expect((await repository.listByUser('alice'))[0]?.completedAt).toBe('2026-10-02T01:02:03.000Z')

    await call('PATCH', `/api/tasks/${id}`, { completed: false })
    expect((await repository.listByUser('alice'))[0]?.completedAt).toBeNull()
  })

  it('requires completed to be a boolean', async () => {
    const response = await call('PATCH', '/api/tasks/x', { completed: 'yes' })
    expect(response.status).toBe(400)
  })

  it('does not let another user change or delete a task', async () => {
    const { id } = (await (await call('POST', '/api/tasks', { title: 'Task' })).json()) as Task

    await call('PATCH', `/api/tasks/${id}`, { completed: true }, 'bob')
    await call('DELETE', `/api/tasks/${id}`, undefined, 'bob')

    const [task] = await repository.listByUser('alice')
    expect(task?.completedAt).toBeNull()
  })

  it('deletes the owner’s task', async () => {
    const { id } = (await (await call('POST', '/api/tasks', { title: 'Task' })).json()) as Task
    expect((await call('DELETE', `/api/tasks/${id}`)).status).toBe(204)
    expect(await repository.listByUser('alice')).toEqual([])
  })

  it('answers unknown routes and methods', async () => {
    expect((await call('PUT', '/api/tasks')).status).toBe(405)
    expect((await call('GET', '/api/tasks/x')).status).toBe(405)
    expect((await call('GET', '/api/other')).status).toBe(404)
  })
})
