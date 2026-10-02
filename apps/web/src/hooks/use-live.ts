import { useEffect, useRef } from 'react'
import { isTasksChanged, reconnectDelay } from '@/lib/live'

/** Calls `onChange` whenever the server reports that the user's tasks changed. */
export function useLive(onChange: () => void) {
  const callback = useRef(onChange)
  useEffect(() => {
    callback.current = onChange
  })

  useEffect(() => {
    let socket: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let attempt = 0
    let closed = false

    function connect() {
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${scheme}://${window.location.host}/api/live`)
      socket.onopen = () => {
        if (attempt > 0) callback.current()
        attempt = 0
        heartbeat = setInterval(() => socket?.send('ping'), 30_000)
      }
      socket.onmessage = (event) => {
        if (isTasksChanged(event.data)) callback.current()
      }
      socket.onclose = () => {
        clearInterval(heartbeat)
        if (closed) return
        timer = setTimeout(connect, reconnectDelay(attempt++))
      }
    }

    connect()
    return () => {
      closed = true
      clearTimeout(timer)
      clearInterval(heartbeat)
      socket?.close()
    }
  }, [])
}
