"""Motor de base de datos y sesiones de SQLAlchemy."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date, datetime

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False, "timeout": 30},
    echo=settings.debug,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@event.listens_for(Engine, "connect")
def _pragmas(dbapi_connection, connection_record):  # pragma: no cover - infraestructura
    cur = dbapi_connection.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=WAL")
    cur.close()


def get_db() -> Iterator[Session]:
    """Dependencia de FastAPI: una sesion por peticion, con commit/rollback automatico."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def hoy() -> date:
    return datetime.now().date()


def ahora() -> datetime:
    return datetime.now()
