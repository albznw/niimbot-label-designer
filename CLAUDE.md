# Niimbot Label Designer

A browser-based label designer + printer app for Niimbot printers, with an optional FastAPI backend relay for remote print queuing.

## Architecture

```
frontend/   React 18 + TypeScript SPA (Vite, Tailwind, Konva, Monaco)
backend/    FastAPI WebSocket relay (Python 3.12, single file: app/main.py)
```

The frontend is fully self-contained (PWA, IndexedDB storage). The backend is optional - used only for remote print queue forwarding over WebSocket.

## Tech Stack

**Frontend**
- React 18 + TypeScript (strict), Vite, Tailwind CSS
- Konva / react-konva - canvas editor
- Monaco Editor - code editor panels (HTML mode + variable editor)
- @mmote/niimbluelib - Bluetooth/Serial printer protocol
- IndexedDB - templates, settings, print history (via `src/lib/db.ts`)
- WebSocket client with auto-reconnect (`src/lib/ws-client.ts`)

**Backend**
- FastAPI + Uvicorn, Python 3.12
- Pillow for image processing
- uv for package management

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/App.tsx` | Root component - all global state lives here |
| `frontend/src/components/designer/LabelCanvas.tsx` | Konva 2D canvas editor, renders bitmap |
| `frontend/src/components/designer/VariableList.tsx` | Monaco TSV editor (line 0 = var names, line 1+ = rows) |
| `frontend/src/components/designer/HtmlEditor.tsx` | Monaco HTML editor with live bitmap preview |
| `frontend/src/lib/db.ts` | IndexedDB: templates, settings, print_history |
| `frontend/src/lib/label-renderer.ts` | Canvas → 1-bit bitmap + dithering algorithms |
| `frontend/src/lib/printer-client.ts` | Singleton wrapping niimbluelib BT/Serial |
| `backend/app/main.py` | Entire backend: WS relay + HTTP print queue API |

## Agent Delegation Rules

**Each agent must do exactly ONE task. Never bundle multiple tasks into one agent.**

- Frontend (React/TypeScript/CSS) changes → `claude-frontend` agent
- Python changes → `claude-pydev` agent (even one-line fixes)
- Exploration/research → `Explore` agent
- Run agents in parallel when tasks are independent

## Development

```bash
# Frontend dev server
cd frontend && npm run dev

# Backend dev server
cd backend && uv run uvicorn app.main:app --reload

# Type check
cd frontend && npx tsc --noEmit

# Build for production
cd frontend && npm run build

# Docker
docker compose up --build
```

## Variable Editor (VariableList)

Uses Monaco Editor with TSV format:
- Line 0: tab-separated variable names (editable - renaming here renames the variable)
- Line 1: tab-separated default values (drives canvas preview)
- Lines 2+: print batch rows

Tab key inserts a real tab character. Cursor line drives `activePrintRow`.

## Bitmap Rendering

- Konva canvas is captured via `konvaStageToCanvas` in `LabelCanvas.tsx`
- Rounded corners are applied as CSS `border-radius` + `overflow: hidden` on the preview wrapper - NOT baked into the bitmap (black pixels in corners would print)
- `renderBitmap()` temporarily disables the layer clipFunc and bg rect cornerRadius before capture, then restores

## Canvas Editor (LabelCanvas)

- Snap guides: combined group bbox used when multiple nodes are selected (Fix 5)
- Distribute: `distributeSelectedInternal` evenly spaces ≥3 nodes
- Align: `alignSelectedInternal` aligns to group bounds
- Undo/redo: 50-step history via ref

## State Persistence

- Templates: IndexedDB (`templates` store), auto-saved with 500ms debounce
- Last opened template: `getSetting('lastTemplateId')` loaded on init
- Backend URL: `getSetting('backendUrl')` loaded on init, connects WS on load

## Styling Conventions

Dark theme: `bg-[#1a1a1a]` (main), `bg-[#2a2a2a]` (panels), `bg-[#1e1e1e]` (editor areas)
Borders: `border-white/10` (standard dividers)
Accent: `text-accent` / `bg-accent` (blue, defined in Tailwind config)
Font: monospace sections use `font-mono text-xs`

## Visual Testing

**Always use Playwright to visually confirm UI changes before reporting done.**

```
mcp__plugin_playwright_playwright__browser_navigate → http://localhost:5173
mcp__plugin_playwright_playwright__browser_take_screenshot
```

Create a template, add variables, confirm the change looks correct visually.
