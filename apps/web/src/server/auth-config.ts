export interface SocialEnv {
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
}

/** Sign-in providers that are switched on. GitHub needs both its client id and its secret. */
export function socialProviders(env: SocialEnv) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return {}
  return { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
}

/** What the login page may know: which sign-in buttons to show. Never the secrets. */
export function publicConfig(env: SocialEnv) {
  return { github: 'github' in socialProviders(env) }
}
