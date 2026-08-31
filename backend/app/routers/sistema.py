"""Configuracion del taller, plan de cuentas, respaldo y estado del servidor."""

from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import ip_local, settings
from ..database import get_db, hoy
from ..errores import ReglaNegocio
from ..models import Config, Cuenta, Producto, Venta
from ..schemas import CuentaIn, CuentaOut, EstadoSistema, Ok
from ..services.contabilidad import balance_general, cfg

router = APIRouter(tags=["sistema"])


@router.get("/config", summary="Configuracion del taller")
def leer_config(db: Session = Depends(get_db)) -> dict[str, str]:
    return {c.clave: (c.valor or "") for c in db.scalars(select(Config)).all()}


@router.put("/config", summary="Actualizar configuracion")
def guardar_config(valores: dict[str, str], db: Session = Depends(get_db)) -> dict[str, str]:
    for clave, valor in valores.items():
        fila = db.get(Config, clave)
        if fila:
            fila.valor = str(valor)
        else:
            db.add(Config(clave=clave, valor=str(valor)))
    db.flush()
    return {c.clave: (c.valor or "") for c in db.scalars(select(Config)).all()}


@router.get("/cuentas", response_model=list[CuentaOut], summary="Plan de cuentas")
def listar_cuentas(db: Session = Depends(get_db)) -> list[Cuenta]:
    return list(db.scalars(select(Cuenta).order_by(Cuenta.codigo)).all())


@router.post("/cuentas", response_model=CuentaOut, status_code=201, summary="Crear cuenta")
def crear_cuenta(datos: CuentaIn, db: Session = Depends(get_db)) -> Cuenta:
    if db.scalar(select(Cuenta).where(Cuenta.codigo == datos.codigo)):
        raise ReglaNegocio(f"Ya existe una cuenta con el codigo {datos.codigo}")
    cuenta = Cuenta(**datos.model_dump(), movimiento=1, sistema=0)
    db.add(cuenta)
    db.flush()
    return cuenta


@router.get("/estado", response_model=EstadoSistema, summary="Estado del sistema")
def estado(db: Session = Depends(get_db)) -> dict:
    balance = balance_general(db, hoy())
    return {
        "ventas": db.scalar(select(func.count(Venta.id))) or 0,
        "productos": db.scalar(select(func.count(Producto.id))) or 0,
        "cuadre": balance["diferencia"],
        "version": settings.version,
        "empresa": cfg(db, "empresa", "Taller de Motos") or "Taller de Motos",
        "servidor": f"http://{ip_local()}:{settings.puerto}",
    }


@router.get("/respaldo", summary="Descargar copia de seguridad")
def respaldo() -> FileResponse:
    """Copia consistente de la base de datos, aunque haya escrituras en curso."""
    carpeta = settings.data_dir / "respaldos"
    carpeta.mkdir(parents=True, exist_ok=True)
    nombre = f"respaldo-taller-{datetime.now():%Y%m%d-%H%M%S}.db"
    destino = carpeta / nombre

    origen = sqlite3.connect(settings.db_path)
    copia = sqlite3.connect(destino)
    with copia:
        origen.backup(copia)
    copia.close()
    origen.close()

    return FileResponse(destino, filename=nombre, media_type="application/octet-stream")


@router.post("/demo", response_model=Ok, summary="Cargar datos de ejemplo")
def cargar_demo(db: Session = Depends(get_db)) -> Ok:
    from ..demo import cargar

    cargar(db)
    return Ok()


@router.delete("/demo", response_model=Ok, summary="Borrar todos los movimientos")
def limpiar(db: Session = Depends(get_db)) -> Ok:
    """Deja la base como recien instalada, conservando el plan de cuentas."""
    from ..models import (
        Asiento,
        AsientoLinea,
        Categoria,
        Compra,
        CompraLinea,
        Gasto,
        Kardex,
        Moto,
        Orden,
        OrdenItem,
        Pago,
        Tercero,
        VentaLinea,
    )

    respaldo_previo = settings.data_dir / "respaldos"
    respaldo_previo.mkdir(parents=True, exist_ok=True)
    marca = f"antes-de-limpiar-{datetime.now():%Y%m%d-%H%M%S}.db"
    shutil.copy(settings.db_path, respaldo_previo / marca)

    for modelo in (
        AsientoLinea,
        Asiento,
        VentaLinea,
        Venta,
        CompraLinea,
        Compra,
        OrdenItem,
        Orden,
        Kardex,
        Pago,
        Gasto,
        Producto,
        Moto,
        Tercero,
    ):
        db.query(modelo).delete()
    db.query(Categoria).delete()
    db.flush()

    from ..seed import sembrar

    sembrar(db)
    return Ok()
