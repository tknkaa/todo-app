import { describe, expect, it } from 'vitest'
import { connectLive, createNotifier, LIVE_MESSAGE } from './live'

function fakeNamespace(failFor?: string) {
  const sent: { room: string; url: string; body: string | null }[] = []
  const namespace = {
    idFromName: (name: string) => name,
    get: (room: string) => ({
      fetch: async (input: string | Request, init?: RequestInit) => {
        if (room === failFor) throw new Error('unreachable')
        sent.push({
          room,
          url: input instanceof Request ? input.url : input,
          body: (init?.body as string | undefined) ?? null,
        })
        return new Response(null, { status: 204 })
      },
    }),
  } as unknown as DurableObjectNamespace
  return { namespace, sent }
}

describe('createNotifier', () => {
  it('broadcasts once to the room of every distinct user', async () => {
    const { namespace, sent } = fakeNamespace()

    await createNotifier(namespace)(['alice', 'bob', 'alice'])

    expect(sent.map((item) => item.room).sort()).toEqual(['alice', 'bob'])
    expect(
      sent.every((item) => item.url.endsWith('/broadcast') && item.body === LIVE_MESSAGE),
    ).toBe(true)
  })

  it('keeps notifying the others when one room fails', async () => {
    const { namespace, sent } = fakeNamespace('alice')

    await expect(createNotifier(namespace)(['alice', 'bob'])).resolves.toBeUndefined()
    expect(sent.map((item) => item.room)).toEqual(['bob'])
  })
})

describe('connectLive', () => {
  it('answers 426 unless the request asks for a WebSocket', () => {
    const { namespace, sent } = fakeNamespace()

    const response = connectLive(new Request('http://localhost/api/live'), namespace, 'alice')

    expect(response).toBeInstanceOf(Response)
    expect((response as Response).status).toBe(426)
    expect(sent).toEqual([])
  })

  it('forwards the upgrade to the room of the user', async () => {
    const { namespace, sent } = fakeNamespace()

    await connectLive(
      new Request('http://localhost/api/live', { headers: { Upgrade: 'websocket' } }),
      namespace,
      'alice',
    )

    expect(sent.map((item) => item.room)).toEqual(['alice'])
  })
})
