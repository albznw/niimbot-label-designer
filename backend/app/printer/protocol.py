from PIL import Image, ImageOps


class NiimbotPacket:
    def __init__(self, type_: int, data: bytes) -> None:
        self.type_ = type_
        self.data = data

    def to_bytes(self) -> bytes:
        length = len(self.data)
        checksum = self.type_ ^ length
        for b in self.data:
            checksum ^= b
        return (
            bytes([0x55, 0x55, self.type_, length])
            + self.data
            + bytes([checksum, 0xAA, 0xAA])
        )

    @classmethod
    def from_bytes(cls, data: bytes) -> "NiimbotPacket":
        if len(data) < 7:
            raise ValueError("Packet too short")
        if data[0] != 0x55 or data[1] != 0x55:
            raise ValueError("Bad header")
        if data[-1] != 0xAA or data[-2] != 0xAA:
            raise ValueError("Bad footer")
        type_ = data[2]
        length = data[3]
        payload = data[4 : 4 + length]
        checksum = data[4 + length]
        expected = type_ ^ length
        for b in payload:
            expected ^= b
        if checksum != expected:
            raise ValueError(f"Checksum mismatch: got {checksum}, expected {expected}")
        return cls(type_=type_, data=bytes(payload))


class RequestCode:
    GET_INFO = 0x40
    HEARTBEAT = 0xDC
    SET_LABEL_TYPE = 0x23
    SET_LABEL_DENSITY = 0x21
    START_PRINT = 0x01
    END_PRINT = 0xF3
    START_PAGE_PRINT = 0x03
    END_PAGE_PRINT = 0xE3
    SET_DIMENSION = 0x13
    SET_QUANTITY = 0x15
    GET_PRINT_STATUS = 0xA3
    PRINT_BITMAP_ROW = 0x85
    PRINT_EMPTY_ROW = 0x84


def _count_bits(data: bytes) -> int:
    count = 0
    for b in data:
        count += bin(b).count("1")
    return count


def image_to_rows(image: Image.Image) -> list[tuple[int, bytes]]:
    """Convert PIL image to list of (row_index, row_bytes) for non-empty rows.

    Inverts and converts to 1-bit. Returns only rows with at least one set bit.
    """
    img = ImageOps.invert(image.convert("L")).convert("1")
    width = img.width
    row_bytes_width = (width + 7) // 8
    rows: list[tuple[int, bytes]] = []

    for y in range(img.height):
        row_data = bytearray(row_bytes_width)
        for x in range(width):
            if img.getpixel((x, y)):
                row_data[x // 8] |= 1 << (7 - (x % 8))
        row_bytes = bytes(row_data)
        if _count_bits(row_bytes) > 0:
            rows.append((y, row_bytes))

    return rows
