/** One room per user: it fans a notification out to all of that user's open browser tabs. */
export class CollaborationRoom {
  constructor(
    private readonly state: DurableObjectState,
    private readonly _env: unknown,
  ) {}

  async fetch(request: Request) {
    const { pathname } = new URL(request.url)

    if (pathname === '/broadcast' && request.method === 'POST') {
      const message = await request.text()
      for (const socket of this.state.getWebSockets()) {
        try {
          socket.send(message)
        } catch {
          // The socket is already closing.
        }
      }
      return new Response(null, { status: 204 })
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 })
    }
    const pair = new WebSocketPair()
    this.state.acceptWebSocket(pair[1])
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (message === 'ping') socket.send('pong')
  }

  webSocketClose(socket: WebSocket, code: number, reason: string) {
    socket.close(code, reason)
  }
}
