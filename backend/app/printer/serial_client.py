import base64
import io
import itertools
import logging
import struct
import time

import serial
from PIL import Image, ImageOps

from .protocol import NiimbotPacket, RequestCode

logger = logging.getLogger(__name__)

_RECV_RETRIES = 6
_SEND_SLEEP = 0.01
_PRINT_STATUS_POLL_INTERVAL = 0.5
_PRINT_STATUS_TIMEOUT = 10.0


class NiimbotSerialPrinter:
    def __init__(self) -> None:
        self._port: serial.Serial | None = None
        self._port_name: str | None = None
        self._packetbuf = bytearray()

    def connect(self, port: str, baudrate: int = 115200) -> None:
        if self._port and self._port.is_open:
            self._port.close()
        self._port = serial.Serial(port, baudrate=baudrate, timeout=0.5)
        self._port_name = port
        logger.info("Connected to %s at %d baud", port, baudrate)

    def disconnect(self) -> None:
        if self._port and self._port.is_open:
            self._port.close()
        self._port = None
        self._port_name = None

    def is_connected(self) -> bool:
        return self._port is not None and self._port.is_open

    def get_port_name(self) -> str | None:
        return self._port_name

    def _send(self, packet: NiimbotPacket) -> None:
        if not self._port or not self._port.is_open:
            raise RuntimeError("Printer not connected")
        self._port.write(packet.to_bytes())
        time.sleep(_SEND_SLEEP)

    def _recv(self) -> list[NiimbotPacket]:
        if not self._port or not self._port.is_open:
            raise RuntimeError("Printer not connected")
        waiting = self._port.in_waiting
        if waiting:
            self._packetbuf.extend(self._port.read(waiting))

        packets: list[NiimbotPacket] = []
        while len(self._packetbuf) >= 7:
            # Find header
            start = self._packetbuf.find(b"\x55\x55")
            if start == -1:
                self._packetbuf.clear()
                break
            if start > 0:
                del self._packetbuf[:start]
            if len(self._packetbuf) < 7:
                break
            length = self._packetbuf[3]
            # header(2) + type(1) + len(1) + data + checksum(1) + footer(2)
            total = 4 + length + 3
            if len(self._packetbuf) < total:
                break
            raw = bytes(self._packetbuf[:total])
            del self._packetbuf[:total]
            try:
                packets.append(NiimbotPacket.from_bytes(raw))
            except ValueError as e:
                logger.warning("Bad packet: %s", e)
        return packets

    def _transceive(
        self, reqcode: int, data: bytes, respoffset: int = 1
    ) -> NiimbotPacket:
        packet = NiimbotPacket(type_=reqcode, data=data)
        self._send(packet)
        for attempt in range(_RECV_RETRIES):
            time.sleep(0.1)
            packets = self._recv()
            for pkt in packets:
                if pkt.type_ == reqcode + respoffset:
                    return pkt
            logger.debug(
                "Transceive attempt %d: no matching response for 0x%02x",
                attempt + 1,
                reqcode,
            )
        raise TimeoutError(
            f"No response for request 0x{reqcode:02x} after {_RECV_RETRIES} retries"
        )

    def set_label_density(self, n: int) -> bool:
        resp = self._transceive(RequestCode.SET_LABEL_DENSITY, struct.pack(">B", n))
        return resp.data[0] == 1

    def set_label_type(self, n: int) -> bool:
        resp = self._transceive(RequestCode.SET_LABEL_TYPE, struct.pack(">B", n))
        return resp.data[0] == 1

    def start_print_v4(self, total_pages: int = 1, page_color: int = 0) -> bool:
        data = struct.pack(">HBBH", 0, total_pages, page_color, 0)
        resp = self._transceive(RequestCode.START_PRINT, data)
        return resp.data[0] == 1

    def start_page_print(self) -> bool:
        resp = self._transceive(RequestCode.START_PAGE_PRINT, b"\x00")
        return resp.data[0] == 1

    def end_page_print(self) -> bool:
        resp = self._transceive(RequestCode.END_PAGE_PRINT, b"\x00")
        return resp.data[0] == 1

    def end_print(self) -> bool:
        resp = self._transceive(RequestCode.END_PRINT, b"\x00")
        return resp.data[0] == 1

    def set_page_size_v3(self, rows: int, cols: int, copies_count: int = 1) -> bool:
        data = struct.pack(">HHH", rows, cols, copies_count)
        resp = self._transceive(RequestCode.SET_DIMENSION, data)
        return resp.data[0] == 1

    def set_bitmap_row(self, row_num: int, data: bytes) -> None:
        header = struct.pack(">HH", row_num, len(data))
        packet = NiimbotPacket(type_=RequestCode.PRINT_BITMAP_ROW, data=header + data)
        self._send(packet)

    def set_empty_row(self, row_num: int, count: int) -> None:
        data = struct.pack(">HB", row_num, count)
        packet = NiimbotPacket(type_=RequestCode.PRINT_EMPTY_ROW, data=data)
        self._send(packet)

    def get_print_status(self) -> dict[str, int]:
        resp = self._transceive(RequestCode.GET_PRINT_STATUS, b"\x00")
        page = struct.unpack(">H", resp.data[0:2])[0]
        progress = resp.data[2] if len(resp.data) > 2 else 0
        return {"page": page, "progress": progress}

    def heartbeat(self) -> dict[str, int]:
        resp = self._transceive(RequestCode.HEARTBEAT, b"\x00")
        return {"closingstate": resp.data[0] if resp.data else 0}

    def _send_image_rows(self, image: Image.Image) -> None:
        """Send all image rows, batching empty rows."""
        img = ImageOps.invert(image.convert("L")).convert("1")
        width = img.width
        height = img.height
        row_bytes_width = (width + 7) // 8

        # Build full row list: (row_index, row_data | None)
        all_rows: list[tuple[int, bytes | None]] = []
        for y in range(height):
            row_data = bytearray(row_bytes_width)
            for x in range(width):
                if img.getpixel((x, y)):
                    row_data[x // 8] |= 1 << (7 - (x % 8))
            row_bytes = bytes(row_data)
            has_bits = any(b != 0 for b in row_bytes)
            all_rows.append((y, row_bytes if has_bits else None))

        # Use cycle to block (wait) every 4th send
        block_cycle = itertools.cycle([False] * 3 + [True])

        empty_start: int | None = None
        empty_count = 0

        def flush_empty() -> None:
            nonlocal empty_start, empty_count
            if empty_start is None or empty_count == 0:
                return
            # Send in chunks of max 255
            sent = 0
            while sent < empty_count:
                chunk = min(255, empty_count - sent)
                self.set_empty_row(empty_start + sent, chunk)
                sent += chunk
            empty_start = None
            empty_count = 0

        for y, row_bytes in all_rows:
            if row_bytes is None:
                if empty_start is None:
                    empty_start = y
                empty_count += 1
            else:
                flush_empty()
                self.set_bitmap_row(y, row_bytes)
                if next(block_cycle):
                    time.sleep(_SEND_SLEEP)

        flush_empty()

    def print_image_b1(
        self, image: Image.Image, density: int = 3, quantity: int = 1
    ) -> None:
        """Full B1 print sequence."""
        self.set_label_density(density)
        self.set_label_type(1)
        self.start_print_v4(total_pages=quantity)
        self.start_page_print()
        self.set_page_size_v3(
            rows=image.height, cols=image.width, copies_count=quantity
        )
        self._send_image_rows(image)
        self.end_page_print()
        self._wait_for_print_end()
        self.end_print()

    def _wait_for_print_end(self) -> None:
        deadline = time.monotonic() + _PRINT_STATUS_TIMEOUT
        while time.monotonic() < deadline:
            try:
                status = self.get_print_status()
                logger.debug("Print status: %s", status)
                if status.get("progress", 0) >= 100:
                    return
            except Exception as e:
                logger.warning("get_print_status error: %s", e)
            time.sleep(_PRINT_STATUS_POLL_INTERVAL)
        logger.warning(
            "Print status did not reach 100%% within %.1fs", _PRINT_STATUS_TIMEOUT
        )

    def print_png_b64(self, png_b64: str, density: int = 3, quantity: int = 1) -> None:
        """Decode base64 PNG, convert to PIL Image, print."""
        png_bytes = base64.b64decode(png_b64)
        image = Image.open(io.BytesIO(png_bytes))
        self.print_image_b1(image, density=density, quantity=quantity)
