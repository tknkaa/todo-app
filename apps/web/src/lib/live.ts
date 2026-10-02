/** Delay before reconnecting the live WebSocket: 1s, 2s, 4s ... capped at 30s. */
export function reconnectDelay(attempt: number) {
  return Math.min(1000 * 2 ** Math.max(0, attempt), 30_000)
}

/** True when a WebSocket message says the user's tasks changed. */
export function isTasksChanged(data: unknown) {
  if (typeof data !== 'string') return false
  try {
    const message: unknown = JSON.parse(data)
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'tasks.changed'
    )
  } catch {
    return false
  }
}

/**
 * Close code to answer a client's close with. Browsers report 1005 (no code sent) and 1006
 * (connection dropped), but those must never be sent, so they are answered with a normal close.
 */
export function replyCloseCode(received: number) {
  return [1004, 1005, 1006, 1015].includes(received) ? 1000 : received
}
