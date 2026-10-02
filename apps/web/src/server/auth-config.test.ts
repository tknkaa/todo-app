import { describe, expect, it } from 'vitest'
import { publicConfig, socialProviders } from './auth-config'

describe('socialProviders', () => {
  it('turns GitHub on when both values are set', () => {
    expect(socialProviders({ GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' })).toEqual({
      github: { clientId: 'id', clientSecret: 'secret' },
    })
  })

  it.each([
    {},
    { GITHUB_CLIENT_ID: 'id' },
    { GITHUB_CLIENT_SECRET: 'secret' },
    { GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: '' },
  ])('leaves GitHub off for %j', (env) => {
    expect(socialProviders(env)).toEqual({})
  })
})

describe('publicConfig', () => {
  it('tells whether GitHub is on without exposing the secret', () => {
    const config = publicConfig({ GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' })
    expect(config).toEqual({ github: true })
    expect(JSON.stringify(config)).not.toContain('secret')
    expect(publicConfig({})).toEqual({ github: false })
  })
})
