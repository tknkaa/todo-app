import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth'
import { drizzle } from 'drizzle-orm/d1'
import { D1TaskMemberRepository } from '@todo/db'
import * as schema from '@todo/db/schema'
import { socialProviders, type SocialEnv } from './auth-config'

interface AuthEnv extends SocialEnv {
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
    socialProviders: socialProviders(env),
    account: {
      // Signing in with GitHub joins an existing account of the same address only when that
      // account's own address is verified. Password sign-ups here are not verified, so GitHub is
      // refused for those addresses: otherwise someone could register another person's address
      // first, and take over the account once that person signs in with GitHub.
      accountLinking: {
        enabled: true,
        trustedProviders: ['github'],
        requireLocalEmailVerified: true,
      },
    },
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
