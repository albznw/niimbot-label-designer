from datetime import datetime

from pydantic import BaseModel


# Template schemas
class TemplateCreate(BaseModel):
    name: str
    mode: str = "canvas"
    label_size: str = "50x30"
    sub_label: str = "top"
    variables: str | None = "[]"
    canvas_json: str | None = None
    html: str | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    mode: str | None = None
    label_size: str | None = None
    sub_label: str | None = None
    variables: str | None = None
    canvas_json: str | None = None
    html: str | None = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    mode: str
    canvas_json: str | None
    html: str | None
    variables: str
    label_size: str
    sub_label: str
    created_at: datetime
    updated_at: datetime


# PrintJob schemas
class PrintRequest(BaseModel):
    template_id: str
    variables: dict
    bitmap_png_b64: str
    printer_name: str = "server"
    density: int = 3
    quantity: int = 1
    use_server_printer: bool = True


class PrintResponse(BaseModel):
    job_id: str
    success: bool


class ConnectRequest(BaseModel):
    port: str
    baudrate: int = 115200


class PrintJobResponse(BaseModel):
    id: str
    template_id: str
    printed_at: datetime
    variables_used: str
    bitmap_path: str | None
    printer_name: str
    success: bool
    error: str | None


class PaginatedPrintJobs(BaseModel):
    items: list[PrintJobResponse]
    total: int
    page: int
    per_page: int


# Printer schemas
class SerialPort(BaseModel):
    device: str
    description: str


class PrinterStatus(BaseModel):
    connected: bool
    port: str | None
