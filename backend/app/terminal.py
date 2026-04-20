import json
from typing import Any

from fastapi import WebSocket


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
