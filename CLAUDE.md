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
| `frontend/src/components/designer/VariableList.tsx` | Monaco CSV editor (line 0 = var names, line 1+ = rows) |
| `frontend/src/components/designer/HtmlEditor.tsx` | Monaco HTML editor with live bitmap preview |
| `frontend/src/lib/db.ts` | IndexedDB: templates, settings, print_history (v4) |
| `frontend/src/lib/label-renderer.ts` | Canvas → 1-bit bitmap + dithering algorithms |
| `frontend/src/lib/printer-client.ts` | Singleton wrapping niimbluelib BT/Serial |
| `backend/app/main.py` | Entire backend: WS relay + HTTP print queue API |

## Orchestration Pattern

**You are a delegator. Never write code or edit files directly. Always delegate to subagents.**

### Before touching anything
1. Read all relevant files to understand the current state
2. Identify the root cause before proposing a solution
3. Present a full plan and get confirmation before starting work

### Planning
- Break work into discrete, single-responsibility tasks
- Identify dependencies between tasks and group them into phases
- Independent tasks run in parallel (single message, multiple Agent calls)
- Dependent tasks run in sequence (wait for phase N before starting phase N+1)
- Run `npx tsc --noEmit` after each phase to catch conflicts early

### Delegation rules
- **Each agent does exactly ONE task. Never bundle unrelated tasks.**
- Frontend (React/TypeScript/CSS) changes → `claude-frontend` agent
- Python changes → `claude-pydev` agent (even one-line fixes)
- Exploration/research → `Explore` agent
- Give agents precise context: exact file paths, line numbers, what to change and why
- Trust but verify: check actual file diffs after agents complete, don't just take their word for it

### Committing
- Group commits by logical concern, not by file
- Stage specific files per commit - never `git add -A`
- Prefix: `fix:`, `feat:`, `refactor:`, `chore:`

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

## Domain Concepts

### Label Profile
A label profile defines the physical label format. Stored as `label_profile: string` on templates. Defined in `types/label.ts` as `LabelProfile`. Three profiles exist: `simple-50x30`, `double-30x15`, `cable-40x30`.

- Do NOT call these "presets" - the correct term is **label profile**
- `getProfileById(id)` in `types/label.ts` is the lookup function
- DB field is `label_profile` (migrated from `preset_id` in v4)

### Cable Label Layout
Canvas is 640×240px (80×30mm at 8px/mm). For `printDirection: 'left'`:
- Left half (0–320px): two stacked 40×15mm label areas (top: y=0–120, bottom: y=120–240)
- Tail: 320px wide, 64px tall (8mm), centered on the top label (y=28–92px)

### Print Direction
`printDirection` on a `LabelProfile` is the physical feed direction. `getEffectivePrintDirection(profile, orientation)` accounts for display orientation flips. Always use this - never raw `orientation` - when drawing the print edge indicator.

## Variable Editor (VariableList)

Uses Monaco Editor with **CSV format** (RFC 4180, quoted fields supported):
- Line 0: comma-separated variable names
- Lines 1+: data rows (line 1 drives canvas preview)

Cursor line drives `activePrintRow`. Old tab-delimited data is auto-migrated on load.

## Bitmap Rendering

- Konva canvas captured via `konvaStageToCanvas` in `LabelCanvas.tsx`
- `renderBitmap()` hides background + overlay layers for clean capture, always restores them in a `try/finally` block - if the canvas throws (e.g. tainted cross-origin data in Firefox), layers are guaranteed to restore
- Rounded corners are visual only - NOT baked into the bitmap

## Canvas Editor (LabelCanvas)

- Snap guides: combined group bbox used when multiple nodes are selected
- Distribute: `distributeSelectedInternal` evenly spaces ≥3 nodes
- Align: `alignSelectedInternal` aligns to group bounds
- Undo/redo: 50-step history via ref

## State Persistence

- Templates: IndexedDB (`templates` store, v4), auto-saved with 500ms debounce
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
