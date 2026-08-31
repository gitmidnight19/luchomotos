"""Configuracion de la aplicacion (variables de entorno con prefijo TALLER_)."""

from __future__ import annotations

import socket
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

RAIZ = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # env_file absoluto: si fuera relativo, solo se leeria cuando el CWD es la
    # raiz del repo y se ignoraria en silencio al arrancar desde otra carpeta.
    model_config = SettingsConfigDict(
        env_prefix="TALLER_",
        env_file=RAIZ / ".env",
        extra="ignore",
    )

    nombre: str = "Taller Contable API"
    version: str = "2.0.0"
    #: Carpeta donde vive la base de datos y los respaldos.
    data_dir: Path = RAIZ / "data"
    db_nombre: str = "taller.db"
    #: 0.0.0.0 permite que los celulares del taller se conecten por WiFi.
    host: str = "0.0.0.0"
    puerto: int = 8321
    #: En desarrollo se permite cualquier origen; la app movil no usa cookies.
    cors_origins: list[str] = ["*"]
    debug: bool = False

    @property
    def db_path(self) -> Path:
        return self.data_dir / self.db_nombre

    @property
    def database_url(self) -> str:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{self.db_path.as_posix()}"


settings = Settings()


def ip_local() -> str:
    """IP del equipo en la red WiFi, para que la app movil sepa a donde conectarse."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return str(s.getsockname()[0])
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()
