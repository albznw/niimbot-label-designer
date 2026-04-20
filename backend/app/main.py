from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.routers import queue
from app.terminal import terminal


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    yield


app = FastAPI(title="Niimbot Print Relay", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(queue.router, prefix="/api")


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
