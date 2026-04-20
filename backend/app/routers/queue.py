from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.terminal import terminal

router = APIRouter()


class BitmapPrintRequest(BaseModel):
    bitmap_b64: str
    width: int
    height: int
    density: int = 3


@router.post("/{template_id}/print", status_code=202)
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


@router.get("/{template_id}/print", status_code=202)
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


@router.post("/print", status_code=202)
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
