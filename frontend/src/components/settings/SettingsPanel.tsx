import { useState } from 'react'
import type { WsStatus } from '../../lib/ws-client'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

interface SettingsPanelProps {
  backendUrl: string
  wsStatus: WsStatus
  onSave: (url: string) => void
  onClose: () => void
}

const STATUS_DOT: Record<WsStatus, string> = {
  connected: 'bg-green-400',
  connecting: 'bg-yellow-400 animate-pulse',
  disconnected: 'bg-gray-500',
}

const STATUS_LABEL: Record<WsStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting...',
  disconnected: 'Disconnected',
}

export function WsStatusDot({ status, onClick }: { status: WsStatus; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`Backend: ${STATUS_LABEL[status]}`}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
      <span className="hidden sm:inline">Backend</span>
    </button>
  )
}

export function SettingsPanel({ backendUrl, wsStatus, onSave, onClose }: SettingsPanelProps) {
  const [url, setUrl] = useState(backendUrl)

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <Input
            id="backend-url"
            label="Backend URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(url.trim()) }}
            placeholder="http://192.168.1.100:8000"
          />
          <p className="mt-1 text-xs text-gray-500">
            Leave empty to run standalone. The frontend will connect via WebSocket for remote print jobs.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[wsStatus]}`} />
          <span className="text-gray-400">{STATUS_LABEL[wsStatus]}</span>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(url.trim())}>Save & Connect</Button>
        </div>
      </div>
    </Modal>
  )
}
