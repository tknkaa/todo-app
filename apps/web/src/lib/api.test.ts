import { describe, expect, it } from 'vitest'
import { messageOf, responseError } from './api'

describe('responseError', () => {
  it('returns the error message of the response body', async () => {
    const response = Response.json({ error: 'タスクが見つかりません。' }, { status: 404 })
    expect(await responseError(response)).toBe('タスクが見つかりません。')
  })

  it.each([new Response('not json', { status: 500 }), Response.json({}), Response.json(null)])(
    'falls back when the body has no message',
    async (response) => {
      expect(await responseError(response)).toBe('リクエストに失敗しました。')
    },
  )
})

describe('messageOf', () => {
  it('uses the message of an Error and the fallback for anything else', () => {
    expect(messageOf(new Error('boom'), 'fallback')).toBe('boom')
    expect(messageOf('boom', 'fallback')).toBe('fallback')
    expect(messageOf(undefined, 'fallback')).toBe('fallback')
  })
})
