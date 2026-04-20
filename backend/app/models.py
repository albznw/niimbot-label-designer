import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel


class Template(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    mode: str = "canvas"  # "canvas" | "html"
    canvas_json: str | None = None
    html: str | None = None
    variables: str = "[]"  # JSON array of {name, type, default}
    label_size: str = "50x30"
    sub_label: str = "top"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PrintJob(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    template_id: str = Field(foreign_key="template.id")
    printed_at: datetime = Field(default_factory=datetime.utcnow)
    variables_used: str = "{}"  # JSON
    bitmap_path: str | None = None
    printer_name: str = ""
    success: bool = True
    error: str | None = None
