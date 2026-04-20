import json
from typing import Any

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class TerminalManager:
    def __init__(self) -> None:
        self.ws: WebSocket | None = None

    async def connect(self, ws: WebSocket) -> None:
        self.ws = ws

    def disconnect(self) -> None:
        self.ws = None

    async def send(self, data: dict[str, Any]) -> bool:
        if self.ws is None:
            return False
        try:
            await self.ws.send_text(json.dumps(data))
            return True
        except Exception:
            self.ws = None
            return False

    @property
    def connected(self) -> bool:
        return self.ws is not None


terminal = TerminalManager()

app = FastAPI(title="Niimbot Print Relay")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws/terminal")
async def terminal_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    await terminal.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        terminal.disconnect()


@app.get("/api/status")
async def status() -> dict[str, bool]:
    return {"terminal_connected": terminal.connected}


class BitmapPrintRequest(BaseModel):
    bitmap_b64: str
    width: int
    height: int
    density: int = 3


@app.post("/api/{template_id}/print", status_code=202)
async def queue_print_batch(
    template_id: str,
    rows: list[dict[str, str]],
) -> dict[str, int]:
    sent = await terminal.send({
        "type": "queue:variables",
        "template_id": template_id,
        "rows": rows,
    })
    if not sent:
        raise HTTPException(status_code=503, detail="No terminal connected")
    return {"queued": len(rows)}


@app.get("/api/{template_id}/print", status_code=202)
async def queue_print_single(
    template_id: str,
    request: Request,
) -> dict[str, int]:
    variables = dict(request.query_params)
    sent = await terminal.send({
        "type": "queue:variables",
        "template_id": template_id,
        "rows": [variables],
    })
    if not sent:
        raise HTTPException(status_code=503, detail="No terminal connected")
    return {"queued": 1}


@app.post("/api/print", status_code=202)
async def queue_print_bitmap(body: BitmapPrintRequest) -> dict[str, int]:
    sent = await terminal.send({
        "type": "queue:bitmap",
        "bitmap_b64": body.bitmap_b64,
        "width": body.width,
        "height": body.height,
        "density": body.density,
    })
    if not sent:
        raise HTTPException(status_code=503, detail="No terminal connected")
    return {"queued": 1}
