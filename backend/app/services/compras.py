"""Compras a proveedores: entrada de inventario y contabilizacion automatica."""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..database import hoy
from ..errores import NoEncontrado, ReglaNegocio
from ..models import Compra, CompraLinea
from ..schemas import CompraIn
from . import inventario
from .contabilidad import (
    Movimiento,
    anular_asientos,
    cuenta_medio,
    iva_general,
    r2,
    registrar_asiento,
)
from .ventas import consecutivo

CTA_INVENTARIO = "1435"
CTA_IVA_COMPRA = "1665"
CTA_PROVEEDORES = "2205"


def crear(db: Session, datos: CompraIn) -> Compra:
    fecha = datos.fecha or hoy()
    if datos.forma_pago == "credito" and not datos.proveedor_id:
        raise ReglaNegocio("Una compra a credito requiere proveedor")

    compra = Compra(
        fecha=fecha,
        proveedor_id=datos.proveedor_id,
        forma_pago=datos.forma_pago,
        metodo=datos.metodo,
        nota=datos.nota,
        numero=datos.numero,
        estado="activa",
    )
    db.add(compra)
    db.flush()
    if not compra.numero:
        compra.numero = consecutivo(db, "prefijo_compra", compra.id)

    iva_def = iva_general(db)
    subtotal = iva_total = 0.0

    for linea in datos.lineas:
        producto = inventario.obtener_producto(db, linea.producto_id)
        iva_pct = linea.iva_pct if linea.iva_pct is not None else iva_def
        base = r2(linea.cantidad * linea.costo_unit)
        subtotal += base
        iva_total += r2(base * iva_pct / 100.0)

        compra.lineas.append(
            CompraLinea(
                producto_id=producto.id,
                cantidad=linea.cantidad,
                costo_unit=linea.costo_unit,
                iva_pct=iva_pct,
                subtotal=base,
            )
        )
        inventario.mover(
            db,
            producto.id,
            fecha,
            "ENTRADA",
            linea.cantidad,
            linea.costo_unit,
            "COMPRA",
            compra.id,
            f"Compra {compra.numero}",
        )
        if linea.precio_venta:
            producto.precio_venta = float(linea.precio_venta)

    compra.subtotal = r2(subtotal)
    compra.iva = r2(iva_total)
    compra.total = r2(compra.subtotal + compra.iva)
    compra.saldo = compra.total if datos.forma_pago == "credito" else 0.0

    movs: list[Movimiento] = [
        (CTA_INVENTARIO, compra.subtotal, 0, f"Entrada de inventario {compra.numero}")
    ]
    if compra.iva:
        movs.append((CTA_IVA_COMPRA, compra.iva, 0, f"IVA descontable {compra.numero}"))
    if datos.forma_pago == "credito":
        movs.append((CTA_PROVEEDORES, 0, compra.total, f"Compra a credito {compra.numero}"))
    else:
        movs.append(
            (cuenta_medio(db, datos.metodo), 0, compra.total, f"Pago compra {compra.numero}")
        )

    registrar_asiento(db, fecha, "COMPRA", compra.id, f"Factura de compra {compra.numero}", movs)
    db.flush()
    return compra


def obtener(db: Session, compra_id: int) -> Compra:
    compra = db.get(Compra, compra_id)
    if compra is None:
        raise NoEncontrado("Compra no encontrada")
    return compra


def anular(db: Session, compra_id: int, motivo: str = "Anulacion de compra") -> None:
    compra = obtener(db, compra_id)
    if compra.estado == "anulada":
        raise ReglaNegocio("La compra ya esta anulada")

    # No se puede anular si ya se vendieron unidades de esa entrada.
    for linea in compra.lineas:
        producto = inventario.obtener_producto(db, linea.producto_id)
        if float(producto.stock) < linea.cantidad - 0.0001:
            raise ReglaNegocio(
                f"No se puede anular: ya se vendieron unidades de '{producto.nombre}'"
            )

    fecha = hoy()
    for linea in compra.lineas:
        inventario.mover(
            db,
            linea.producto_id,
            fecha,
            "SALIDA",
            linea.cantidad,
            0,
            "COMPRA-ANUL",
            compra.id,
            f"Anulacion compra {compra.numero}",
        )
    anular_asientos(db, "COMPRA", compra.id, fecha, f"{motivo} {compra.numero}")
    compra.estado = "anulada"
    compra.saldo = 0.0
    db.flush()
