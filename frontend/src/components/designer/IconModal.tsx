import { useEffect, useMemo, useRef, useState } from 'react'
import { ICONS, type IconEntry } from '../../data/icon-list'

export interface IconModalProps {
  onSelect: (filename: string) => void
  onClose: () => void
}

// Persist scroll position across modal open/close cycles
let persistedScrollTop = 0
let persistedActiveCategory: string | null = null
let persistedSearch = ''

interface CategoryGroup {
  category: string
  items: IconEntry[]
}

function groupByCategory(icons: IconEntry[]): CategoryGroup[] {
  const map = new Map<string, IconEntry[]>()
  for (const icon of icons) {
    const arr = map.get(icon.category)
    if (arr) {
      arr.push(icon)
    } else {
      map.set(icon.category, [icon])
    }
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }))
}

export function IconModal({ onSelect, onClose }: IconModalProps) {
  const [search, setSearch] = useState(persistedSearch)
  const [activeCategory, setActiveCategory] = useState<string | null>(persistedActiveCategory)

  const rightPanelRef = useRef<HTMLDivElement | null>(null)
  const scrollTopRef = useRef<number>(persistedScrollTop)
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ICONS
    return ICONS.filter((i) => i.name.toLowerCase().includes(q))
  }, [search])

  const groups = useMemo(() => groupByCategory(filtered), [filtered])
  const allCategories = useMemo(() => groupByCategory(ICONS).map((g) => g.category), [])

  // Restore scroll position after mount
  useEffect(() => {
    const el = rightPanelRef.current
    if (!el) return
    el.scrollTop = scrollTopRef.current
  }, [])

  // Track scroll position
  const handleScroll = () => {
    const el = rightPanelRef.current
    if (!el) return
    scrollTopRef.current = el.scrollTop
    persistedScrollTop = el.scrollTop
  }

  // Persist search / active category as they change
  useEffect(() => {
    persistedSearch = search
  }, [search])
  useEffect(() => {
    persistedActiveCategory = activeCategory
  }, [activeCategory])

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const scrollToCategory = (category: string) => {
    setActiveCategory(category)
    const section = sectionRefs.current.get(category)
    const panel = rightPanelRef.current
    if (section && panel) {
      const top = section.offsetTop - panel.offsetTop
      panel.scrollTo({ top, behavior: 'smooth' })
    }
  }

  const handleSelect = (filename: string) => {
    onSelect(filename)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl flex flex-col"
        style={{ width: '80vw', height: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#2a2a2a] rounded-t-lg shrink-0">
          <h2 className="text-sm font-semibold text-white">Icon Picker</h2>
          <input
            type="text"
            name="icon-search"
            autoComplete="off"
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-md text-xs bg-[#1a1a1a] border border-white/10 rounded px-2 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <span className="text-xs text-gray-500">{filtered.length} icons</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar: categories */}
          <div className="w-48 shrink-0 border-r border-white/10 bg-[#2a2a2a] overflow-y-auto">
            <ul className="py-1">
              {allCategories.map((cat) => {
                const isActive = activeCategory === cat
                return (
                  <li key={cat}>
                    <button
                      onClick={() => scrollToCategory(cat)}
                      className={`w-full text-left text-xs px-3 py-1.5 transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-[#333]'
                      }`}
                    >
                      {cat}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Right panel: grid */}
          <div
            ref={rightPanelRef}
            className="flex-1 overflow-y-auto"
            onScroll={handleScroll}
          >
            {groups.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                No icons match "{search}"
              </div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.category}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(group.category, el)
                    else sectionRefs.current.delete(group.category)
                  }}
                  className="px-4 py-3"
                >
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 sticky top-0 bg-[#1a1a1a] py-1 z-10">
                    {group.category}
                    <span className="ml-2 text-gray-600 font-normal normal-case tracking-normal">
                      {group.items.length}
                    </span>
                  </h3>
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))' }}
                  >
                    {group.items.map((icon) => (
                      <button
                        key={icon.filename}
                        type="button"
                        title={icon.name}
                        onClick={() => handleSelect(icon.filename)}
                        className="aspect-square flex items-center justify-center rounded border border-transparent hover:border-white/20 hover:bg-[#333] transition-colors p-1.5"
                      >
                        <img
                          src={`/icons/${icon.filename}`}
                          alt={icon.name}
                          className="w-full h-full object-contain"
                          style={{ filter: 'invert(1)', imageRendering: 'pixelated' }}
                          loading="lazy"
                          draggable={false}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
