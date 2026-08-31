"""Motor de base de datos y sesiones de SQLAlchemy."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date, datetime

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


def configurar_sqlite(motor: Engine, *, wal: bool = True) -> Engine:
    """Activa integridad referencial (y WAL) en un motor SQLite concreto.

    Se aplica al motor recibido y no a la clase `Engine`: un listener global
    alcanzaria a TODOS los motores del proceso, incluido el de Alembic, y las
    migraciones en modo batch (que recrean la tabla) fallarian con
    `FOREIGN KEY constraint failed` al soltar la tabla original.
    """

    @event.listens_for(motor, "connect")
    def _pragmas(dbapi_connection, connection_record):  # pragma: no cover
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        if wal:
            cur.execute("PRAGMA journal_mode=WAL")
        cur.close()

    return motor


engine = configurar_sqlite(
    create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False, "timeout": 30},
        echo=settings.debug,
    )
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


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
