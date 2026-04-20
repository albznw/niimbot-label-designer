import type { PrinterStatus } from '../../lib/printer-client'

interface PrinterPanelProps {
  status: PrinterStatus
  connecting: boolean
  onConnectBLE: () => Promise<void>
  onConnectSerial: () => Promise<void>
  onDisconnect: () => Promise<void>
}

export function PrinterPanel({
  status,
  connecting,
  onConnectBLE,
  onConnectSerial,
  onDisconnect,
}: PrinterPanelProps) {
  const dotColor = connecting
    ? 'bg-yellow-400'
    : status.connected
    ? 'bg-green-400'
    : 'bg-gray-500'

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-[#222] rounded border border-white/10">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
      <span className="text-xs text-gray-300 min-w-[120px] truncate">
        {connecting
          ? 'Connecting...'
          : status.connected && status.deviceName
          ? status.deviceName
          : 'Not connected'}
      </span>
      {!status.connected && (
        <>
          <button
            onClick={onConnectBLE}
            disabled={connecting}
            className="text-xs px-2 py-0.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            BLE
          </button>
          <button
            onClick={onConnectSerial}
            disabled={connecting}
            className="text-xs px-2 py-0.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            USB
          </button>
        </>
      )}
      {status.connected && (
        <button
          onClick={onDisconnect}
          className="text-xs px-2 py-0.5 bg-red-800 hover:bg-red-700 rounded transition-colors"
        >
          Disconnect
        </button>
      )}
    </div>
  )
}
