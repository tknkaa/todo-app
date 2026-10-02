import { describe, expect, it } from 'vitest'
import { D1TaskMemberRepository, D1TaskRepository } from '@todo/db'
import { createTestDatabase, insertUser } from '@todo/db/testing'
import { getAuth } from './auth'

describe('sign-up', () => {
  it('gives a new account the tasks that were shared with its email beforehand', async () => {
    const database = createTestDatabase()
    const tasks = new D1TaskRepository(database)
    await insertUser(database, 'alice')
    await tasks.create({
      id: 't1',
      userId: 'alice',
      title: 'one',
      status: 'todo',
      dueAt: null,
      completedAt: null,
      remindBeforeMinutes: null,
    })
    await new D1TaskMemberRepository(database).addByEmail('t1', 'newcomer@example.com')

    const response = await getAuth({
      DB: database,
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret',
      BETTER_AUTH_URL: 'http://localhost',
    }).handler(
      new Request('http://localhost/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          email: 'Newcomer@Example.com',
          password: 'password1234',
          name: 'Newcomer',
        }),
      }),
    )
    expect(response.status).toBe(200)

    const { user } = (await response.json()) as { user: { id: string } }
    expect((await tasks.listByUser(user.id)).map((task) => task.id)).toEqual(['t1'])
  })
})
