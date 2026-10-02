import { describe, expect, it } from 'vitest'
import { oauthErrorMessage } from './oauth-error'

describe('oauthErrorMessage', () => {
  it('explains that an address already registered with a password cannot be joined', () => {
    expect(oauthErrorMessage('unable_to_link_account')).toContain('メールとパスワードで登録')
  })

  it('explains a GitHub account with no usable email', () => {
    expect(oauthErrorMessage('email_not_found')).toContain('メールアドレスがありません')
    expect(oauthErrorMessage('email_not_verified')).toContain('確認されていません')
  })

  it.each(['invalid_code', 'no_code', 'anything-else', ''])(
    'falls back to a general message for %j',
    (code) => {
      expect(oauthErrorMessage(code)).toBe(
        'GitHub でのログインに失敗しました。もう一度試してください。',
      )
    },
  )
})
