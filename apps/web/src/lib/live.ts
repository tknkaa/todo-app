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
