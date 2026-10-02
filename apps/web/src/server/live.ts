import type { Notify } from './tasks/handler'

/** Every connected browser of a user is a WebSocket of that user's room. */
export function createNotifier(namespace: DurableObjectNamespace): Notify {
  return async (userIds) => {
    await Promise.all(
      [...new Set(userIds)].map(async (userId) => {
        try {
          await namespace
            .get(namespace.idFromName(userId))
            .fetch('https://room/broadcast', { method: 'POST', body: LIVE_MESSAGE })
        } catch (error) {
          // A missed notification only delays the update until the next reload.
          console.error('live notification failed', error)
        }
      }),
    )
  }
}

export function connectLive(request: Request, namespace: DurableObjectNamespace, userId: string) {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Expected a WebSocket upgrade', { status: 426 })
  }
  return namespace.get(namespace.idFromName(userId)).fetch(request)
}

export const LIVE_MESSAGE = JSON.stringify({ type: 'tasks.changed' })
