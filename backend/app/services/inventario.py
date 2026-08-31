"""Inventario: kardex y costeo por promedio ponderado.

El costo promedio **no se almacena**: se almacena el valor total de las
existencias (`Producto.valor_inventario`, en centavos) y el promedio se deriva
al leer. Esto no es un detalle de implementacion, es lo que hace que la cuenta
de control 1435 no pueda desviarse del auxiliar: el asiento contabiliza
exactamente el mismo entero en que decrece el valor del producto.

Guardar el promedio redondeado y multiplicarlo por el stock produce un numero
que nunca coincide con la suma de asientos ya registrados; esa era la causa de
que el mayor marcara 20.001,00 contra un kardex de 20.000,50.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..dinero import Centavos, multiplicar
from ..errores import NoEncontrado, ReglaNegocio
from ..models import Kardex, Producto
from .contabilidad import Movimiento, registrar_asiento

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


def _costo_de_salida(producto: Producto, unidades: float) -> Centavos:
    """Valor que sale del inventario al despachar `unidades`.

    Si se lleva toda la existencia sale exactamente todo el valor: asi el
    producto queda en cero limpio, sin residuos de redondeo que despues nadie
    podria justificar.
    """
    if producto.stock <= 0:
        return 0
    if unidades >= producto.stock:
        return producto.valor_inventario
    return round(producto.valor_inventario * unidades / producto.stock)


def mover(
    db: Session,
    producto_id: int,
    fecha: date,
    tipo: TipoMovimiento,
    cantidad: float,
    costo_unit: Centavos = 0,
    doc_tipo: str | None = None,
    doc_id: int | None = None,
    nota: str | None = None,
    valor: Centavos | None = None,
) -> Centavos:
    """Registra un movimiento y devuelve su costo en centavos.

    - ENTRADA: suma `cantidad x costo_unit` al valor del inventario.
    - SALIDA: valoriza en proporcion al valor vigente (`costo_unit` se ignora).
    - AJUSTE: `cantidad` lleva signo; positiva entra, negativa sale.

    `valor` fuerza el importe exacto del movimiento. Lo usan las anulaciones:
    deben devolver al inventario justo el entero que salio, porque el
    contra-asiento reversa ese mismo entero. Recalcularlo desde el costo
    unitario da un numero distinto por redondeo y desliga el mayor del auxiliar.
    """
    producto = obtener_producto(db, producto_id)

    if tipo == "ENTRADA":
        unidades = abs(float(cantidad))
        costo = valor if valor is not None else multiplicar(costo_unit, unidades)
        producto.stock += unidades
        producto.valor_inventario += costo
        signo = unidades
    elif tipo == "SALIDA":
        unidades = abs(float(cantidad))
        costo = valor if valor is not None else _costo_de_salida(producto, unidades)
        producto.stock -= unidades
        producto.valor_inventario -= costo
        signo = -unidades
    else:
        delta = float(cantidad)
        if delta >= 0:
            costo = multiplicar(costo_unit, delta)
            producto.stock += delta
            producto.valor_inventario += costo
        else:
            costo = _costo_de_salida(producto, abs(delta))
            producto.stock += delta
            producto.valor_inventario -= costo
        signo = delta

    # El stock es una cantidad (admite fracciones); el valor es entero exacto.
    producto.stock = round(producto.stock, 4)
    if producto.stock <= 0:
        # Sin existencias no puede quedar valor: seria inventario fantasma.
        producto.valor_inventario = 0

    db.add(
        Kardex(
            producto_id=producto_id,
            fecha=fecha,
            tipo=tipo,
            doc_tipo=doc_tipo,
            doc_id=doc_id,
            cantidad=signo,
            costo_unit=round(costo / abs(signo)) if signo else 0,
            costo_total=costo,
            saldo_cant=producto.stock,
            saldo_costo=producto.valor_inventario,
            saldo_unit=round(producto.costo_promedio),
            nota=nota,
        )
    )
    db.flush()
    return costo


def validar_existencias(db: Session, requerido: dict[int, float]) -> None:
    """Comprueba que haya stock suficiente antes de tocar la base de datos."""
    for producto_id, cantidad in requerido.items():
        producto = obtener_producto(db, producto_id)
        if float(producto.stock) < cantidad - 0.0001:
            raise ReglaNegocio(
                f"Stock insuficiente de '{producto.nombre}': "
                f"disponible {producto.stock}, requerido {cantidad}"
            )


def ajustar(
    db: Session,
    producto_id: int,
    cantidad: float,
    modo: Literal["conteo", "delta"] = "conteo",
    fecha: date | None = None,
    costo_unit: Centavos | None = None,
    nota: str | None = None,
) -> float:
    """Ajuste por conteo fisico o entrada/salida manual. Devuelve el delta aplicado."""
    from ..database import hoy

    producto = obtener_producto(db, producto_id)
    fecha = fecha or hoy()
    delta = round(cantidad - producto.stock, 4) if modo == "conteo" else float(cantidad)
    if abs(delta) < 0.0001:
        return 0.0

    detalle = nota or "Ajuste de inventario"
    # Un sobrante sin costo indicado entra al costo promedio vigente.
    unitario = costo_unit if costo_unit is not None else round(producto.costo_promedio)
    valor = mover(db, producto_id, fecha, "AJUSTE", delta, unitario, "AJUSTE", producto_id, detalle)
    movs: list[Movimiento]
    if delta > 0:
        movs = [(CTA_INVENTARIO, valor, 0, detalle), (CTA_OTROS_ING, 0, valor, detalle)]
    else:
        movs = [(CTA_PERDIDA_INV, valor, 0, detalle), (CTA_INVENTARIO, 0, valor, detalle)]
    registrar_asiento(
        db, fecha, "AJUSTE", producto_id, f"Ajuste inventario: {producto.nombre}", movs
    )
    return delta


def saldo_inicial(
    db: Session,
    producto_id: int,
    cantidad: float,
    costo_unit: Centavos,
    fecha: date | None = None,
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
                (CTA_INVENTARIO, valor, 0, "Saldo inicial de inventario"),
                (CTA_CAPITAL, 0, valor, "Aporte en inventario"),
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
