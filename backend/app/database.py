from collections.abc import Generator
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

_data_dir = Path(settings.data_dir)
_data_dir.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{_data_dir / 'niimbot.db'}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
