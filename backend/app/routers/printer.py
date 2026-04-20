import asyncio
import base64
import json
import logging
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, WebSocket
from serial.tools import list_ports
from sqlmodel import Session

from app.config import settings
from app.database import get_session
from app.models import PrintJob
from app.printer.manager import PrinterManager
from app.schemas import (
    ConnectRequest,
    PrinterStatus,
    PrintRequest,
    PrintResponse,
    SerialPort,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["printer"])

SessionDep = Annotated[Session, Depends(get_session)]

_bitmaps_dir = Path(settings.data_dir) / "bitmaps"


def _save_bitmap(job_id: str, png_b64: str) -> str:
    bitmaps_dir = Path(settings.data_dir) / "bitmaps"
    bitmaps_dir.mkdir(parents=True, exist_ok=True)
    png_bytes = base64.b64decode(png_b64)
    bitmap_path = bitmaps_dir / f"{job_id}.png"
    bitmap_path.write_bytes(png_bytes)
    return str(bitmap_path)


@router.post("/print", response_model=PrintResponse)
async def print_label(body: PrintRequest, session: SessionDep) -> PrintResponse:
    job = PrintJob(
        template_id=body.template_id,
        variables_used=json.dumps(body.variables),
        printer_name=body.printer_name,
        success=True,
    )

    try:
        job.bitmap_path = _save_bitmap(job.id, body.bitmap_png_b64)
    except Exception as exc:
        job.success = False
        job.error = str(exc)
        session.add(job)
        session.commit()
        raise HTTPException(
            status_code=400, detail=f"Failed to decode bitmap: {exc}"
        ) from exc

    if body.use_server_printer:
        manager = PrinterManager.get()
        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(
                None,
                lambda: manager.printer.print_png_b64(
                    body.bitmap_png_b64, body.density, body.quantity
                ),
            )
        except Exception as exc:
            job.success = False
            job.error = str(exc)
            logger.error("Print job %s failed: %s", job.id, exc)

    session.add(job)
    session.commit()
    session.refresh(job)
    return PrintResponse(job_id=job.id, success=job.success)


@router.get("/printer/ports", response_model=list[SerialPort])
def list_serial_ports() -> list[SerialPort]:
    return [
        SerialPort(device=port.device, description=port.description or "")
        for port in list_ports.comports()
    ]


@router.get("/printer/status", response_model=PrinterStatus)
def printer_status() -> PrinterStatus:
    status = PrinterManager.get().get_status()
    return PrinterStatus(
        connected=bool(status["connected"]),
        port=str(status["port"]) if status["port"] else None,
    )


@router.post("/printer/connect")
def connect_printer(body: ConnectRequest) -> dict[str, object]:
    try:
        PrinterManager.get().printer.connect(body.port, body.baudrate)
        return {"success": True, "port": body.port}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/printer/disconnect")
def disconnect_printer() -> dict[str, bool]:
    PrinterManager.get().printer.disconnect()
    return {"success": True}


@router.websocket("/printer/ws")
async def printer_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            status = PrinterManager.get().get_status()
            await websocket.send_json(status)
            await asyncio.sleep(2)
    except Exception:
        pass
