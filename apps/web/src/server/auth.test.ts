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

describe('GitHub sign-in', () => {
  const social = (env: { GITHUB_CLIENT_ID?: string; GITHUB_CLIENT_SECRET?: string }) =>
    getAuth({
      DB: createTestDatabase(),
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret',
      BETTER_AUTH_URL: 'http://localhost',
      ...env,
    }).handler(
      new Request('http://localhost/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({ provider: 'github', callbackURL: '/' }),
      }),
    )

  it('sends the browser to GitHub with the app’s callback address when it is configured', async () => {
    const response = await social({ GITHUB_CLIENT_ID: 'client-id', GITHUB_CLIENT_SECRET: 'secret' })
    expect(response.status).toBe(200)

    const { url } = (await response.json()) as { url: string }
    const target = new URL(url)
    expect(target.origin + target.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(target.searchParams.get('client_id')).toBe('client-id')
    expect(target.searchParams.get('redirect_uri')).toBe(
      'http://localhost/api/auth/callback/github',
    )
    expect(target.searchParams.get('scope')).toContain('user:email')
  })

  it('refuses to sign in with GitHub when it is not configured', async () => {
    expect((await social({})).ok).toBe(false)
  })
})
