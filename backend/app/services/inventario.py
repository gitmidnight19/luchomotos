"""Inventario: kardex y costo promedio ponderado."""

from __future__ import annotations

from datetime import date
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..errores import NoEncontrado, ReglaNegocio
from ..models import Kardex, Producto
from .contabilidad import Movimiento, r2, registrar_asiento

TipoMovimiento = Literal["ENTRADA", "SALIDA", "AJUSTE"]

CTA_INVENTARIO = "1435"
CTA_PERDIDA_INV = "6150"
CTA_OTROS_ING = "4210"
CTA_CAPITAL = "3105"


def obtener_producto(db: Session, producto_id: int) -> Producto:
    producto = db.get(Producto, producto_id)
    if producto is None:
        raise NoEncontrado(f"El repuesto {producto_id} no existe")
    return producto


def mover(
    db: Session,
    producto_id: int,
    fecha: date,
    tipo: TipoMovimiento,
    cantidad: float,
    costo_unit: float = 0.0,
    doc_tipo: str | None = None,
    doc_id: int | None = None,
    nota: str | None = None,
) -> float:
    """Registra un movimiento de inventario y devuelve su costo.

    - ENTRADA: recalcula el costo promedio ponderado con el costo de la compra.
    - SALIDA: valoriza al costo promedio vigente (el parametro `costo_unit` se ignora).
    - AJUSTE: `cantidad` lleva signo; positiva entra, negativa sale.
    """
    producto = obtener_producto(db, producto_id)
    stock = r2(producto.stock)
    promedio = float(producto.costo_promedio or 0)
    valor = stock * promedio

    if tipo == "ENTRADA":
        unidades = abs(float(cantidad))
        costo_total = r2(unidades * float(costo_unit))
        stock_nuevo = stock + unidades
        valor_nuevo = valor + costo_total
        promedio_nuevo = (valor_nuevo / stock_nuevo) if stock_nuevo > 0 else float(costo_unit)
        signo = unidades
    elif tipo == "SALIDA":
        unidades = abs(float(cantidad))
        costo_unit = promedio
        costo_total = r2(unidades * promedio)
        stock_nuevo = stock - unidades
        restante = valor - costo_total
        valor_nuevo = max(restante, 0.0) if stock_nuevo <= 0 else restante
        promedio_nuevo = promedio
        signo = -unidades
    else:
        delta = float(cantidad)
        if delta >= 0:
            costo_unit = float(costo_unit or promedio)
            costo_total = r2(delta * costo_unit)
            stock_nuevo = stock + delta
            valor_nuevo = valor + costo_total
            promedio_nuevo = (valor_nuevo / stock_nuevo) if stock_nuevo > 0 else costo_unit
        else:
            costo_unit = promedio
            costo_total = r2(abs(delta) * promedio)
            stock_nuevo = stock + delta
            valor_nuevo = max(valor - costo_total, 0.0)
            promedio_nuevo = promedio
        signo = delta

    producto.stock = r2(stock_nuevo)
    producto.costo_promedio = round(promedio_nuevo, 4)

    db.add(
        Kardex(
            producto_id=producto_id,
            fecha=fecha,
            tipo=tipo,
            doc_tipo=doc_tipo,
            doc_id=doc_id,
            cantidad=signo,
            costo_unit=round(float(costo_unit or 0), 4),
            costo_total=costo_total,
            saldo_cant=producto.stock,
            saldo_costo=r2(valor_nuevo),
            saldo_unit=producto.costo_promedio,
            nota=nota,
        )
    )
    db.flush()
    return costo_total


def validar_existencias(db: Session, requerido: dict[int, float]) -> None:
    """Comprueba que haya stock suficiente antes de tocar la base de datos."""
    for producto_id, cantidad in requerido.items():
        producto = obtener_producto(db, producto_id)
        if float(producto.stock) < cantidad - 0.0001:
            raise ReglaNegocio(
                f"Stock insuficiente de '{producto.nombre}': "
                f"disponible {r2(producto.stock)}, requerido {r2(cantidad)}"
            )


def ajustar(
    db: Session,
    producto_id: int,
    cantidad: float,
    modo: Literal["conteo", "delta"] = "conteo",
    fecha: date | None = None,
    costo_unit: float | None = None,
    nota: str | None = None,
) -> float:
    """Ajuste por conteo fisico o entrada/salida manual. Devuelve el delta aplicado."""
    from ..database import hoy

    producto = obtener_producto(db, producto_id)
    fecha = fecha or hoy()
    delta = r2(cantidad - float(producto.stock)) if modo == "conteo" else float(cantidad)
    if abs(delta) < 0.0001:
        return 0.0

    detalle = nota or "Ajuste de inventario"
    valor = mover(
        db,
        producto_id,
        fecha,
        "AJUSTE",
        delta,
        float(costo_unit or producto.costo_promedio or 0),
        "AJUSTE",
        producto_id,
        detalle,
    )
    movs: list[Movimiento]
    if delta > 0:
        movs = [(CTA_INVENTARIO, valor, 0.0, detalle), (CTA_OTROS_ING, 0.0, valor, detalle)]
    else:
        movs = [(CTA_PERDIDA_INV, valor, 0.0, detalle), (CTA_INVENTARIO, 0.0, valor, detalle)]
    registrar_asiento(
        db, fecha, "AJUSTE", producto_id, f"Ajuste inventario: {producto.nombre}", movs
    )
    return delta


def saldo_inicial(
    db: Session, producto_id: int, cantidad: float, costo_unit: float, fecha: date | None = None
) -> None:
    """Carga inicial de existencias, contabilizada como aporte de capital."""
    from ..database import hoy

    if cantidad <= 0:
        return
    fecha = fecha or hoy()
    valor = mover(
        db,
        producto_id,
        fecha,
        "ENTRADA",
        cantidad,
        costo_unit,
        "APERTURA",
        producto_id,
        "Saldo inicial",
    )
    if valor:
        registrar_asiento(
            db,
            fecha,
            "APERTURA",
            producto_id,
            "Inventario inicial",
            [
                (CTA_INVENTARIO, valor, 0.0, "Saldo inicial de inventario"),
                (CTA_CAPITAL, 0.0, valor, "Aporte en inventario"),
            ],
        )


def kardex(
    db: Session, producto_id: int, desde: date | None = None, hasta: date | None = None
) -> list[Kardex]:
    consulta = select(Kardex).where(Kardex.producto_id == producto_id)
    if desde:
        consulta = consulta.where(Kardex.fecha >= desde)
    if hasta:
        consulta = consulta.where(Kardex.fecha <= hasta)
    return list(db.scalars(consulta.order_by(Kardex.id)).all())
