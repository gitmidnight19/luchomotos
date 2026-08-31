"""Ordenes de trabajo: recepcion de la moto y paso a factura."""

from __future__ import annotations

from typing import cast

from sqlalchemy.orm import Session

from ..database import hoy
from ..dinero import Centavos, multiplicar, porcentaje
from ..errores import NoEncontrado, ReglaNegocio
from ..models import Orden, OrdenItem, Venta
from ..schemas import (
    FacturarOrdenIn,
    OrdenIn,
    OrdenItemIn,
    TipoLinea,
    VentaIn,
    VentaLineaIn,
)
from . import ventas as servicio_ventas
from .contabilidad import iva_general
from .ventas import consecutivo


def obtener(db: Session, orden_id: int) -> Orden:
    orden = db.get(Orden, orden_id)
    if orden is None:
        raise NoEncontrado("Orden no encontrada")
    return orden


def _items(db: Session, items: list[OrdenItemIn]) -> list[OrdenItem]:
    iva_def = iva_general(db)
    return [
        OrdenItem(
            tipo=item.tipo,
            producto_id=item.producto_id,
            servicio_id=item.servicio_id,
            descripcion=item.descripcion,
            cantidad=item.cantidad,
            precio_unit=item.precio_unit,
            iva_pct=item.iva_pct if item.iva_pct is not None else iva_def,
        )
        for item in items
    ]


def crear(db: Session, datos: OrdenIn) -> Orden:
    orden = Orden(
        fecha=datos.fecha or hoy(),
        cliente_id=datos.cliente_id,
        moto_id=datos.moto_id,
        km=datos.km,
        estado=datos.estado,
        mecanico=datos.mecanico,
        diagnostico=datos.diagnostico,
        notas=datos.notas,
    )
    orden.items = _items(db, datos.items)
    db.add(orden)
    db.flush()
    orden.numero = consecutivo(db, "prefijo_orden", orden.id)
    db.flush()
    return orden


def actualizar(db: Session, orden_id: int, datos: OrdenIn) -> Orden:
    orden = obtener(db, orden_id)
    if orden.estado == "facturada":
        raise ReglaNegocio("La orden ya fue facturada y no se puede modificar")

    orden.fecha = datos.fecha or orden.fecha
    orden.cliente_id = datos.cliente_id
    orden.moto_id = datos.moto_id
    orden.km = datos.km
    orden.estado = datos.estado
    orden.mecanico = datos.mecanico
    orden.diagnostico = datos.diagnostico
    orden.notas = datos.notas
    orden.items = _items(db, datos.items)
    db.flush()
    return orden


def anular(db: Session, orden_id: int) -> None:
    orden = obtener(db, orden_id)
    if orden.estado == "facturada":
        raise ReglaNegocio("No se puede anular una orden ya facturada")
    orden.estado = "anulada"
    db.flush()


def facturar(db: Session, orden_id: int, datos: FacturarOrdenIn) -> Venta:
    """Convierte la orden en factura: descarga inventario y contabiliza."""
    orden = obtener(db, orden_id)
    if orden.estado == "facturada":
        raise ReglaNegocio("La orden ya fue facturada")
    if not orden.items:
        raise ReglaNegocio("La orden no tiene items para facturar")

    lineas = [
        VentaLineaIn(
            # `orden.items` viene del ORM, donde la columna es str.
            tipo=cast(TipoLinea, item.tipo),
            producto_id=item.producto_id,
            servicio_id=item.servicio_id,
            descripcion=item.descripcion,
            cantidad=item.cantidad,
            precio_unit=item.precio_unit,
            iva_pct=item.iva_pct,
            descuento=0,
        )
        for item in orden.items
    ]
    return servicio_ventas.crear(
        db,
        VentaIn(
            fecha=datos.fecha or hoy(),
            cliente_id=orden.cliente_id,
            moto_id=orden.moto_id,
            orden_id=orden.id,
            forma_pago=datos.forma_pago,
            metodo=datos.metodo,
            nota=f"Orden de trabajo {orden.numero or ''}".strip(),
            lineas=lineas,
        ),
    )


def total_orden(orden: Orden) -> Centavos:
    """Total estimado de la orden, con IVA, en centavos."""
    total: Centavos = 0
    for item in orden.items:
        base = multiplicar(item.precio_unit, item.cantidad)
        total += base + porcentaje(base, item.iva_pct or 0)
    return total
