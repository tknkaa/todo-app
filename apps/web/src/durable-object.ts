export class CollaborationRoom {
  constructor(
    private readonly state: DurableObjectState,
    private readonly _env: unknown,
  ) {}

  async fetch(_request: Request) {
    const pair = new WebSocketPair()
    this.state.acceptWebSocket(pair[1])
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer) {
    // Broadcast/persistence will be added when the task editing protocol is defined.
  }
}
