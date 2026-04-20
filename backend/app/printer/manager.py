from .serial_client import NiimbotSerialPrinter


class PrinterManager:
    _instance: "PrinterManager | None" = None

    def __init__(self) -> None:
        self.printer = NiimbotSerialPrinter()

    @classmethod
    def get(cls) -> "PrinterManager":
        if cls._instance is None:
            cls._instance = PrinterManager()
        return cls._instance

    def get_status(self) -> dict[str, object]:
        return {
            "connected": self.printer.is_connected(),
            "port": self.printer.get_port_name(),
        }
