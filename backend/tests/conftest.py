"""Configuracion de las pruebas: base de datos temporal y cliente HTTP."""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

# La configuracion se lee al importar la app, asi que el directorio de datos
# temporal debe quedar definido antes de cualquier import de `app`.
TMP = Path(tempfile.mkdtemp(prefix="taller-test-"))
os.environ["TALLER_DATA_DIR"] = str(TMP)
os.environ["TALLER_DB_NOMBRE"] = "prueba.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import sembrar  # noqa: E402


@pytest.fixture(autouse=True)
def base_limpia() -> Iterator[None]:
    """Cada prueba corre sobre una base recien creada con el plan de cuentas."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        sembrar(db)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db() -> Iterator[SessionLocal]:
    sesion = SessionLocal()
    try:
        yield sesion
        sesion.commit()
    finally:
        sesion.close()


@pytest.fixture
def cliente() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def producto(cliente: TestClient) -> dict:
    """Un repuesto con 10 unidades a 10.000 de costo."""
    respuesta = cliente.post(
        "/api/productos",
        json={
            "nombre": "Bujia de prueba",
            "sku": "TEST-001",
            "precio_venta": 20000,
            "stock_min": 2,
            "stock_inicial": 10,
            "costo_inicial": 10000,
        },
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


@pytest.fixture
def cliente_taller(cliente: TestClient) -> dict:
    respuesta = cliente.post(
        "/api/terceros", json={"nombre": "Cliente de prueba", "tipo": "cliente"}
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()
