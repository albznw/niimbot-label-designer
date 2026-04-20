from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_db_and_tables
from app.mqtt.client import mqtt_bridge
from app.routers import history, printer, queue, templates


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    create_db_and_tables()
    Path(settings.data_dir, "bitmaps").mkdir(parents=True, exist_ok=True)
    if settings.mqtt_url:
        mqtt_bridge.start(settings.mqtt_url)
    yield
    if settings.mqtt_url:
        mqtt_bridge.stop()


app = FastAPI(title="Niimbot Label Designer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(templates.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(printer.router, prefix="/api")
app.include_router(queue.router, prefix="/api")
