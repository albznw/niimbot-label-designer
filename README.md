# Niimbot Label Designer

A browser-based label designer and print queue for Niimbot printers. No driver install, no desktop app. Design labels on a canvas or in HTML, connect over Bluetooth or Serial, and print directly from the browser. Supports batch printing with variable substitution via a CSV variable editor.

![Niimbot Label Designer](docs/Niimbot%20Label%20Designer.jpeg)

Note: A vibe coded project but it get's the job done!

## Features

- Drag-and-drop canvas editor (text, QR codes, barcodes, images)
- HTML mode with live bitmap preview
- Variable substitution via CSV editor - batch print rows with different values
- Batch print with per-row selection and bitmap carousel preview
- Tested with the B1 Niimbot printer
- Bluetooth and Serial printer connection (via Web Bluetooth / Web Serial)
- Three label profiles: 50×30mm, 2× 30×15mm, Cable 40×30mm
- Optional FastAPI backend relay for remote print queue over WebSocket
- PWA - works offline, installable

## Label Profiles

| Profile | Physical size | Use case |
|---------|---------------|----------|
| 50×30mm | 50 × 30 mm | General purpose labels |
| 2× 30×15mm | 2 × 30 × 15 mm (dual) | Small paired labels |
| Cable 40×30mm | 40 × 30 mm (wrap) | Cable and wire labels |

## Getting Started

### Browser only

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, connect your printer via Bluetooth or Serial from the toolbar.

### With backend relay

The backend is optional - use it to forward print jobs over WebSocket from a remote machine.

```bash
cd backend
uv run uvicorn app.main:app --reload
```

Or with Docker:

```bash
docker compose up --build
```

Enter the backend URL in Settings to connect.

The backend relay acts as a shared print queue. Your browser (with the printer connected) stays open and listens for incoming jobs via WebSocket. Other devices or scripts on your network can submit print jobs to the backend over HTTP, and the frontend picks them up and prints them automatically.

**Example:** the label designer is open on your desktop with the printer connected. From a script on another machine, POST a print job to `http://192.168.1.50:8000/queue`. The frontend receives it over WebSocket and prints without any manual intervention.

## Development

```bash
# Frontend dev server
cd frontend && npm run dev

# Backend dev server
cd backend && uv run uvicorn app.main:app --reload

# Type check
cd frontend && npx tsc --noEmit

# Production build
cd frontend && npm run build
```

## Tech Stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Konva / react-konva, Monaco Editor, @mmote/niimbluelib, IndexedDB

**Backend:** FastAPI, Uvicorn, Python 3.12, Pillow, uv


## Acknowledgements

[niimbluelib](https://github.com/MultiMote/niimbluelib) by [MultiMote](https://github.com/MultiMote) - the Bluetooth/Serial protocol library that makes talking to Niimbot printers possible. This project would not exist without it.

## License

MIT - see [LICENSE](LICENSE)
