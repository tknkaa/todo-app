import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth'
import { drizzle } from 'drizzle-orm/d1'
import { D1TaskMemberRepository } from '@todo/db'
import * as schema from '@todo/db/schema'

interface AuthEnv {
  DB: D1Database
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL?: string
}

export function getAuth(env: AuthEnv) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL ?? 'http://localhost:8787',
    basePath: '/api/auth',
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: 'sqlite',
      schema: {
        ...schema,
        user: schema.users,
        session: schema.authSessions,
        account: schema.authAccounts,
        verification: schema.authVerifications,
      },
    }),
    emailAndPassword: { enabled: true },
    databaseHooks: {
      user: {
        create: {
          // Tasks shared with this address before it had an account show up on first sign-up.
          after: async (user) => {
            await new D1TaskMemberRepository(env.DB).acceptInvites(
              user.id,
              user.email.toLowerCase(),
            )
          },
        },
      },
    },
  })
}
