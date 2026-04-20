import { useState, useEffect, useCallback } from 'react'
import * as db from '../../lib/db'
import type { PrintJobRecord, PrintHistoryResponse } from '../../lib/db'

interface PrintHistoryProps {
  onClose: () => void
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatAbsolute(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

export function PrintHistory({ onClose }: PrintHistoryProps) {
  const [jobs, setJobs] = useState<PrintJobRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const loadPage = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const res: PrintHistoryResponse = await db.getPrintHistory(p)
      setJobs((prev) => (p === 1 ? res.items : [...prev, ...res.items]))
      setTotal(res.total)
      setPage(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPage(1)
  }, [loadPage])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[#2a2a2a] border-l border-white/10 w-[400px] h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
          <h2 className="text-sm font-semibold">Print History</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
        </div>

        {toast && (
          <div className="mx-4 mt-3 text-xs text-yellow-300 bg-yellow-900/30 border border-yellow-700/40 rounded px-3 py-2">
            {toast}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading && jobs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Loading...</div>
          ) : error ? (
            <div className="flex items-center justify-center h-32 text-red-400 text-sm">{error}</div>
          ) : jobs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">No print jobs yet</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {jobs.map((job) => (
                <li key={job.id} className="flex gap-3 p-4">
                  <div className="w-16 h-10 shrink-0 bg-[#1a1a1a] rounded border border-white/10 overflow-hidden flex items-center justify-center">
                    {job.bitmap_png_b64 ? (
                      <img
                        src={db.getBitmapDataUrl(job) ?? ''}
                        alt="label"
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <span className="text-gray-600 text-[10px]">no img</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-300 truncate font-mono">{job.template_id}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          job.success
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-red-900/50 text-red-300'
                        }`}
                      >
                        {job.success ? 'OK' : 'Error'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span title={formatAbsolute(job.printed_at)}>{formatRelative(job.printed_at)}</span>
                      <span>·</span>
                      <span className="truncate">{job.printer_name}</span>
                    </div>
                    {job.error && (
                      <p className="text-[11px] text-red-400 truncate">{job.error}</p>
                    )}
                    <button
                      onClick={() => showToast('Reprint not yet implemented')}
                      className="self-start text-[11px] px-2 py-0.5 bg-[#333] hover:bg-[#444] rounded transition-colors mt-0.5"
                    >
                      Reprint
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!loading && jobs.length < total && (
            <div className="p-4">
              <button
                onClick={() => loadPage(page + 1)}
                className="w-full text-xs py-2 bg-[#333] hover:bg-[#444] rounded transition-colors"
              >
                Load more ({total - jobs.length} remaining)
              </button>
            </div>
          )}

          {loading && jobs.length > 0 && (
            <div className="p-4 text-center text-xs text-gray-500">Loading...</div>
          )}
        </div>
      </div>
    </div>
  )
}
