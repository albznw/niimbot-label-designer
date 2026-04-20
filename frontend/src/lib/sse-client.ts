type QueueEvent =
  | { type: 'queue:variables'; template_id: string; rows: Record<string, string>[] }
  | { type: 'queue:bitmap'; bitmap_b64: string; width: number; height: number; label_size: string; orientation: string; density: number }

type Handler = (event: QueueEvent) => void

class SSEClient {
  private es: EventSource | null = null
  private handler: Handler | null = null
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  connect(handler: Handler) {
    this.handler = handler
    this.es = new EventSource(this.baseUrl + '/api/queue/stream')
    this.es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as QueueEvent
        this.handler?.(event)
      } catch {
        // ignore malformed events
      }
    }
    this.es.onerror = () => {
      // EventSource auto-reconnects
    }
  }

  disconnect() {
    this.es?.close()
    this.es = null
  }
}

export const sseClient = new SSEClient(import.meta.env.VITE_API_URL ?? '')
export type { QueueEvent }
