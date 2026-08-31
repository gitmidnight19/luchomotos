"""Ventas: facturacion, contabilizacion automatica y anulacion."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import hoy
from ..dinero import Centavos, multiplicar, porcentaje
from ..errores import NoEncontrado, ReglaNegocio
from ..models import Producto, Servicio, Venta, VentaLinea
from ..schemas import VentaIn
from . import inventario
from .contabilidad import (
    Movimiento,
    anular_asientos,
    cfg,
    cuenta_medio,
    iva_general,
    registrar_asiento,
)

CTA_CLIENTES = "1305"
CTA_INVENTARIO = "1435"
CTA_IVA_VENTA = "2408"
CTA_ING_REPUESTOS = "4135"
CTA_ING_SERVICIOS = "4140"
CTA_COSTO_REPUESTOS = "6135"


def consecutivo(db: Session, clave_prefijo: str, numero_id: int) -> str:
    return f"{cfg(db, clave_prefijo, '') or ''}{numero_id:05d}"


def crear(db: Session, datos: VentaIn) -> Venta:
    """Registra la factura, descarga inventario y genera el asiento contable."""
    fecha = datos.fecha or hoy()
    if datos.forma_pago == "credito" and not datos.cliente_id:
        raise ReglaNegocio("Una venta a credito requiere cliente")

    requerido: dict[int, float] = {}
    for linea in datos.lineas:
        if linea.tipo == "producto" and linea.producto_id:
            requerido[linea.producto_id] = requerido.get(linea.producto_id, 0) + linea.cantidad
    inventario.validar_existencias(db, requerido)

    venta = Venta(
        fecha=fecha,
        cliente_id=datos.cliente_id,
        moto_id=datos.moto_id,
        orden_id=datos.orden_id,
        forma_pago=datos.forma_pago,
        metodo=datos.metodo,
        nota=datos.nota,
        estado="activa",
    )
    db.add(venta)
    db.flush()
    venta.numero = consecutivo(db, "prefijo_venta", venta.id)

    iva_def = iva_general(db)
    sub_repuestos: Centavos = 0
    sub_servicios: Centavos = 0
    iva_total: Centavos = 0
    costo_total: Centavos = 0
    descuentos: Centavos = 0

    for linea in datos.lineas:
        iva_pct = linea.iva_pct if linea.iva_pct is not None else iva_def
        base = multiplicar(linea.precio_unit, linea.cantidad) - linea.descuento
        iva_total += porcentaje(base, iva_pct)
        descuentos += linea.descuento
        costo_unit: Centavos = 0
        costo_linea: Centavos = 0
        descripcion = linea.descripcion

        if linea.tipo == "producto" and linea.producto_id:
            producto = inventario.obtener_producto(db, linea.producto_id)
            costo_unit = round(producto.costo_promedio)
            costo_linea = inventario.mover(
                db,
                producto.id,
                fecha,
                "SALIDA",
                linea.cantidad,
                costo_unit,
                "VENTA",
                venta.id,
                f"Venta {venta.numero}",
            )
            sub_repuestos += base
            descripcion = descripcion or producto.nombre
        else:
            sub_servicios += base
            if not descripcion and linea.servicio_id:
                servicio = db.get(Servicio, linea.servicio_id)
                descripcion = servicio.nombre if servicio else "Servicio"
            descripcion = descripcion or "Servicio"

        costo_total += costo_linea
        venta.lineas.append(
            VentaLinea(
                tipo=linea.tipo,
                producto_id=linea.producto_id,
                servicio_id=linea.servicio_id,
                descripcion=descripcion,
                cantidad=linea.cantidad,
                precio_unit=linea.precio_unit,
                descuento=linea.descuento,
                iva_pct=iva_pct,
                subtotal=base,
                costo_unit=costo_unit,
                costo_total=costo_linea,
            )
        )

    venta.subtotal = sub_repuestos + sub_servicios
    venta.iva = iva_total
    venta.descuento = descuentos
    venta.total = venta.subtotal + venta.iva
    venta.costo_total = costo_total
    venta.saldo = venta.total if datos.forma_pago == "credito" else 0

    movs: list[Movimiento] = []
    if datos.forma_pago == "credito":
        movs.append((CTA_CLIENTES, venta.total, 0, f"Venta a credito {venta.numero}"))
    else:
        movs.append(
            (cuenta_medio(db, datos.metodo), venta.total, 0, f"Recaudo venta {venta.numero}")
        )
    if sub_repuestos:
        movs.append((CTA_ING_REPUESTOS, 0, sub_repuestos, f"Repuestos {venta.numero}"))
    if sub_servicios:
        movs.append((CTA_ING_SERVICIOS, 0, sub_servicios, f"Servicios {venta.numero}"))
    if venta.iva:
        movs.append((CTA_IVA_VENTA, 0, venta.iva, f"IVA generado {venta.numero}"))
    if venta.costo_total:
        movs.append((CTA_COSTO_REPUESTOS, venta.costo_total, 0, f"Costo de ventas {venta.numero}"))
        movs.append((CTA_INVENTARIO, 0, venta.costo_total, f"Salida inventario {venta.numero}"))

    registrar_asiento(db, fecha, "VENTA", venta.id, f"Factura de venta {venta.numero}", movs)

    if datos.orden_id:
        from ..models import Orden

        orden = db.get(Orden, datos.orden_id)
        if orden:
            orden.estado = "facturada"
            orden.venta_id = venta.id

    db.flush()
    return venta


def obtener(db: Session, venta_id: int) -> Venta:
    venta = db.get(Venta, venta_id)
    if venta is None:
        raise NoEncontrado("Factura no encontrada")
    return venta


def anular(db: Session, venta_id: int, motivo: str = "Anulacion de factura") -> None:
    """Devuelve el inventario al mismo costo con que salio y reversa el asiento."""
    venta = obtener(db, venta_id)
    if venta.estado == "anulada":
        raise ReglaNegocio("La factura ya esta anulada")

    fecha = hoy()
    for linea in venta.lineas:
        if linea.tipo == "producto" and linea.producto_id:
            inventario.mover(
                db,
                linea.producto_id,
                fecha,
                "ENTRADA",
                linea.cantidad,
                linea.costo_unit,
                "VENTA-ANUL",
                venta.id,
                f"Devolucion por anulacion {venta.numero}",
                # Exactamente lo que salio: el contra-asiento reversa ese entero.
                valor=linea.costo_total,
            )
    anular_asientos(db, "VENTA", venta.id, fecha, f"{motivo} {venta.numero}")
    venta.estado = "anulada"
    venta.saldo = 0

    from ..models import Orden

    for orden in db.scalars(select(Orden).where(Orden.venta_id == venta.id)).all():
        orden.estado = "terminada"
        orden.venta_id = None
    db.flush()


def precio_producto(db: Session, producto_id: int) -> Centavos:
    producto = db.get(Producto, producto_id)
    return producto.precio_venta if producto else 0
