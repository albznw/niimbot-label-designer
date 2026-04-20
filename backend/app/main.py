import base64
import io
import json
from typing import Any

from fastapi import FastAPI, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
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


@app.post("/api/print/image", status_code=202)
async def queue_print_image(
    file: UploadFile,
    width: int | None = None,
    height: int | None = None,
    density: int = 3,
) -> dict[str, int]:
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert("L")
    if width or height:
        w = width or int(img.width * (height / img.height))  # type: ignore[operator]
        h = height or int(img.height * (width / img.width))  # type: ignore[operator]
        img = img.resize((w, h), Image.LANCZOS)
    img1 = img.convert("1")
    w, h = img1.width, img1.height
    row_bytes = (w + 7) // 8
    buf = bytearray(row_bytes * h)
    for y in range(h):
        for x in range(w):
            if img1.getpixel((x, y)) == 0:  # dark pixel
                buf[y * row_bytes + x // 8] |= 1 << (7 - (x % 8))
    bitmap_b64 = base64.b64encode(bytes(buf)).decode()
    sent = await terminal.send({
        "type": "queue:bitmap",
        "bitmap_b64": bitmap_b64,
        "width": w,
        "height": h,
        "density": density,
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
