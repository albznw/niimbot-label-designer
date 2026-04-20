import asyncio
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session
from sse_starlette.sse import EventSourceResponse

from ..database import get_session
from ..models import Template

router = APIRouter()

# SSE broadcaster
_clients: list[asyncio.Queue[str]] = []


async def _broadcast(event: dict[str, Any]) -> None:
    data = json.dumps(event)
    dead = []
    for q in _clients:
        try:
            q.put_nowait(data)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        _clients.remove(q)


# SSE stream endpoint
@router.get("/queue/stream")
async def queue_stream(request: Request) -> EventSourceResponse:
    q: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
    _clients.append(q)

    async def event_generator() -> Any:
        try:
            yield {"event": "connected", "data": "ok"}
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield {"data": data}
                except TimeoutError:
                    yield {"event": "ping", "data": ""}
        finally:
            if q in _clients:
                _clients.remove(q)

    return EventSourceResponse(event_generator())


# Queue variables (POST batch)
@router.post("/{template_id}/print", status_code=202)
async def queue_print_batch(
    template_id: str,
    rows: list[dict[str, str]],
    session: Session = Depends(get_session),  # noqa: B008
) -> dict[str, int]:
    template = session.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    await _broadcast({
        "type": "queue:variables",
        "template_id": template_id,
        "rows": rows,
    })
    return {"queued": len(rows)}


# Queue variables (GET single)
@router.get("/{template_id}/print", status_code=202)
async def queue_print_single(
    template_id: str,
    request: Request,
    session: Session = Depends(get_session),  # noqa: B008
) -> dict[str, int]:
    template = session.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    variables = dict(request.query_params)
    await _broadcast({
        "type": "queue:variables",
        "template_id": template_id,
        "rows": [variables],
    })
    return {"queued": 1}


# Bitmap relay
class BitmapPrintRequest(BaseModel):
    bitmap_b64: str
    width: int
    height: int
    label_size: str = "50x30"
    orientation: str = "landscape"
    density: int = 3


@router.post("/print/bitmap", status_code=202)
async def queue_print_bitmap(body: BitmapPrintRequest) -> dict[str, int]:
    await _broadcast({
        "type": "queue:bitmap",
        "bitmap_b64": body.bitmap_b64,
        "width": body.width,
        "height": body.height,
        "label_size": body.label_size,
        "orientation": body.orientation,
        "density": body.density,
    })
    return {"queued": 1}
