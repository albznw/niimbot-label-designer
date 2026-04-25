export type WsEvent =
  | { type: 'queue:variables'; template_id: string; rows: Record<string, string>[] }
  | { type: 'queue:bitmap'; bitmap_b64: string; width: number; height: number; density: number }

export type WsStatus = 'disconnected' | 'connecting' | 'connected'

type Handler = (event: WsEvent) => void
type StatusHandler = (status: WsStatus) => void

class WsClient {
  private ws: WebSocket | null = null
  private handler: Handler | null = null
  private statusHandler: StatusHandler | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private url: string | null = null
  private _status: WsStatus = 'disconnected'
  private intentionalClose = false
  private reconnectDelay = 1000

  private setStatus(s: WsStatus) {
    this._status = s
    this.statusHandler?.(s)
  }

  getStatus(): WsStatus {
    return this._status
  }

  connect(url: string, handler: Handler, statusHandler?: StatusHandler) {
    this.intentionalClose = false
    this.url = url
    this.handler = handler
    if (statusHandler) this.statusHandler = statusHandler
    this._open()
  }

  private _open() {
    if (!this.url) return
    this.setStatus('connecting')
    let ws: WebSocket
    try {
      ws = new WebSocket(this.url)
    } catch {
      this._scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.reconnectDelay = 1000
      this.setStatus('connected')
    }

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as WsEvent
        this.handler?.(event)
      } catch {
        // ignore malformed
      }
    }

    ws.onclose = () => {
      this.setStatus('disconnected')
      if (!this.intentionalClose) this._scheduleReconnect()
    }

    ws.onerror = () => ws.close()
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) return
    const delay = this.reconnectDelay
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.intentionalClose) this._open()
    }, delay)
  }

  disconnect() {
    this.intentionalClose = true
    this.url = null
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.setStatus('disconnected')
    this.handler = null
    this.statusHandler = null
  }

  reconnectTo(url: string) {
    const h = this.handler
    const sh = this.statusHandler
    this.disconnect()
    if (h) this.connect(url, h, sh ?? undefined)
  }
}

export const wsClient = new WsClient()
