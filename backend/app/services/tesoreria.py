"""Gastos, cobros, pagos, traslados de fondos y asientos manuales."""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..database import hoy
from ..errores import NoEncontrado, ReglaNegocio
from ..models import Asiento, Compra, Cuenta, Gasto, Pago, Venta
from ..schemas import AsientoManualIn, GastoIn, PagoIn, TrasladoIn
from .contabilidad import Movimiento, anular_asientos, cuenta_medio, r2, registrar_asiento

CTA_CLIENTES = "1305"
CTA_PROVEEDORES = "2205"
CTA_POR_PAGAR = "2335"


# ------------------------------------------------------------------- gastos
def crear_gasto(db: Session, datos: GastoIn) -> Gasto:
    cuenta = db.get(Cuenta, datos.cuenta_id)
    if cuenta is None or cuenta.tipo not in ("GASTO", "COSTO"):
        raise ReglaNegocio("Debe elegir una cuenta de gasto o de costo")

    fecha = datos.fecha or hoy()
    gasto = Gasto(
        fecha=fecha,
        cuenta_id=cuenta.id,
        descripcion=datos.descripcion,
        monto=r2(datos.monto),
        metodo=datos.metodo,
        proveedor_id=datos.proveedor_id,
        estado="activo",
    )
    db.add(gasto)
    db.flush()

    detalle = datos.descripcion or cuenta.nombre
    if datos.metodo == "credito":
        contrapartida = CTA_PROVEEDORES if datos.proveedor_id else CTA_POR_PAGAR
    else:
        contrapartida = cuenta_medio(db, datos.metodo)

    registrar_asiento(
        db,
        fecha,
        "GASTO",
        gasto.id,
        f"Gasto: {detalle}",
        [(cuenta.codigo, gasto.monto, 0, detalle), (contrapartida, 0, gasto.monto, detalle)],
    )
    return gasto


def anular_gasto(db: Session, gasto_id: int) -> None:
    gasto = db.get(Gasto, gasto_id)
    if gasto is None:
        raise NoEncontrado("Gasto no encontrado")
    if gasto.estado == "anulado":
        raise ReglaNegocio("El gasto ya esta anulado")
    anular_asientos(db, "GASTO", gasto.id, hoy(), "Anulacion de gasto")
    gasto.estado = "anulado"


# --------------------------------------------------------- cobros y pagos
def registrar_pago(db: Session, datos: PagoIn) -> Pago:
    """Abono de un cliente (`cobro`) o pago a un proveedor (`pago`)."""
    fecha = datos.fecha or hoy()
    monto = r2(datos.monto)
    tercero_id = datos.tercero_id
    doc_tipo = None
    referencia = ""

    if datos.clase == "cobro":
        if datos.doc_id:
            venta = db.get(Venta, datos.doc_id)
            if venta is None or venta.estado == "anulada":
                raise ReglaNegocio("Factura no valida")
            if monto > r2(venta.saldo) + 0.01:
                raise ReglaNegocio(f"El abono supera el saldo pendiente ({venta.saldo:.2f})")
            venta.saldo = r2(venta.saldo - monto)
            tercero_id = tercero_id or venta.cliente_id
            doc_tipo = "VENTA"
            referencia = venta.numero or ""
        movs: list[Movimiento] = [
            (cuenta_medio(db, datos.metodo), monto, 0, f"Cobro {referencia}"),
            (CTA_CLIENTES, 0, monto, f"Abono cliente {referencia}"),
        ]
    else:
        if datos.doc_id:
            compra = db.get(Compra, datos.doc_id)
            if compra is None or compra.estado == "anulada":
                raise ReglaNegocio("Compra no valida")
            if monto > r2(compra.saldo) + 0.01:
                raise ReglaNegocio(f"El pago supera el saldo pendiente ({compra.saldo:.2f})")
            compra.saldo = r2(compra.saldo - monto)
            tercero_id = tercero_id or compra.proveedor_id
            doc_tipo = "COMPRA"
            referencia = compra.numero or ""
        movs = [
            (CTA_PROVEEDORES, monto, 0, f"Pago proveedor {referencia}"),
            (cuenta_medio(db, datos.metodo), 0, monto, f"Salida de dinero {referencia}"),
        ]

    pago = Pago(
        fecha=fecha,
        clase=datos.clase,
        tercero_id=tercero_id,
        doc_tipo=doc_tipo,
        doc_id=datos.doc_id,
        monto=monto,
        metodo=datos.metodo,
        nota=datos.nota,
        estado="activo",
    )
    db.add(pago)
    db.flush()

    titulo = "Cobro a cliente" if datos.clase == "cobro" else "Pago a proveedor"
    registrar_asiento(
        db,
        fecha,
        "COBRO" if datos.clase == "cobro" else "PAGO",
        pago.id,
        f"{titulo} {referencia}",
        movs,
    )
    return pago


# ------------------------------------------------------------- tesoreria
def traslado(db: Session, datos: TrasladoIn) -> Asiento:
    """Consignacion o retiro entre caja y banco."""
    if datos.origen == datos.destino:
        raise ReglaNegocio("El origen y el destino deben ser distintos")
    fecha = datos.fecha or hoy()
    monto = r2(datos.monto)
    nota = datos.nota or "Traslado de fondos"
    asiento = registrar_asiento(
        db,
        fecha,
        "TRASLADO",
        None,
        nota,
        [
            (cuenta_medio(db, datos.destino), monto, 0, nota),
            (cuenta_medio(db, datos.origen), 0, monto, nota),
        ],
    )
    if asiento is None:  # pragma: no cover - monto validado por Pydantic
        raise ReglaNegocio("El traslado no genero movimientos")
    return asiento


def asiento_manual(db: Session, datos: AsientoManualIn) -> Asiento:
    """Para casos especiales: depreciaciones, correcciones, aportes."""
    movs: list[Movimiento] = []
    for linea in datos.lineas:
        cuenta = db.get(Cuenta, linea.cuenta_id)
        if cuenta is None:
            raise NoEncontrado(f"Cuenta {linea.cuenta_id} no encontrada")
        movs.append((cuenta.codigo, linea.debe, linea.haber, linea.detalle))

    asiento = registrar_asiento(
        db,
        datos.fecha or hoy(),
        "MANUAL",
        None,
        datos.descripcion or "Asiento manual",
        movs,
    )
    if asiento is None:
        raise ReglaNegocio("El asiento no tiene movimientos")
    return asiento
