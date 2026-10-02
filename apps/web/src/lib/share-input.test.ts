import { describe, expect, it } from 'vitest'
import { parseShareInput } from './share-input'

describe('parseShareInput', () => {
  it('trims and lowercases the email', () => {
    expect(parseShareInput({ email: '  Bob@Example.COM ' })).toEqual({
      ok: true,
      email: 'bob@example.com',
    })
  })

  it.each([{ email: 'not-an-email' }, { email: '' }, { email: 42 }, {}, null])(
    'rejects %j',
    (input) => {
      expect(parseShareInput(input)).toEqual({
        ok: false,
        message: 'メールアドレスを正しく入力してください。',
      })
    },
  )
})
