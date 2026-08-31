"""Ventas, compras, ordenes de trabajo, gastos y movimientos de dinero."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Rango, rango
from ..models import Compra, Gasto, Orden, Pago, Venta
from ..schemas import (
    AsientoManualIn,
    CompraDetalle,
    CompraIn,
    CompraLineaOut,
    CompraOut,
    CreadoOut,
    FacturarOrdenIn,
    GastoIn,
    GastoOut,
    Ok,
    OrdenDetalle,
    OrdenIn,
    OrdenItemOut,
    OrdenOut,
    PagoIn,
    PagoOut,
    TrasladoIn,
    VentaDetalle,
    VentaIn,
    VentaLineaOut,
    VentaOut,
)
from ..services import compras as srv_compras
from ..services import ordenes as srv_ordenes
from ..services import tesoreria as srv_tesoreria
from ..services import ventas as srv_ventas

router = APIRouter()


# -------------------------------------------------------------------- ventas
def _venta_out(venta: Venta) -> VentaOut:
    dto = VentaOut.model_validate(venta)
    dto.cliente_nombre = venta.cliente.nombre if venta.cliente else None
    return dto


@router.get("/ventas", response_model=list[VentaOut], tags=["ventas"])
def listar_ventas(
    periodo: Rango = Depends(rango),
    solo_pendientes: bool = Query(False, description="Solo facturas con saldo por cobrar"),
    db: Session = Depends(get_db),
) -> list[VentaOut]:
    consulta = select(Venta).where(Venta.fecha >= periodo.desde, Venta.fecha <= periodo.hasta)
    if solo_pendientes:
        consulta = consulta.where(Venta.saldo > 0.01, Venta.estado == "activa")
    consulta = consulta.order_by(Venta.fecha.desc(), Venta.id.desc())
    return [_venta_out(v) for v in db.scalars(consulta).all()]


@router.get("/ventas/{venta_id}", response_model=VentaDetalle, tags=["ventas"])
def ver_venta(venta_id: int, db: Session = Depends(get_db)) -> VentaDetalle:
    venta = srv_ventas.obtener(db, venta_id)
    dto = VentaDetalle.model_validate(venta)
    if venta.cliente:
        dto.cliente_nombre = venta.cliente.nombre
        dto.documento = venta.cliente.documento
        dto.telefono = venta.cliente.telefono
        dto.direccion = venta.cliente.direccion
    if venta.moto:
        dto.placa = venta.moto.placa
        dto.marca = venta.moto.marca
        dto.linea_moto = venta.moto.linea
    dto.lineas = [VentaLineaOut.model_validate(x) for x in venta.lineas]
    dto.pagos = [
        PagoOut.model_validate(p)
        for p in db.scalars(
            select(Pago)
            .where(Pago.doc_tipo == "VENTA", Pago.doc_id == venta_id)
            .order_by(Pago.fecha)
        ).all()
    ]
    return dto


@router.post("/ventas", response_model=CreadoOut, status_code=201, tags=["ventas"])
def crear_venta(datos: VentaIn, db: Session = Depends(get_db)) -> CreadoOut:
    venta = srv_ventas.crear(db, datos)
    return CreadoOut(id=venta.id, numero=venta.numero)


@router.post("/ventas/{venta_id}/anular", response_model=Ok, tags=["ventas"])
def anular_venta(venta_id: int, db: Session = Depends(get_db)) -> Ok:
    srv_ventas.anular(db, venta_id)
    return Ok()


# ------------------------------------------------------------------- compras
def _compra_out(compra: Compra) -> CompraOut:
    dto = CompraOut.model_validate(compra)
    dto.proveedor_nombre = compra.proveedor.nombre if compra.proveedor else None
    return dto


@router.get("/compras", response_model=list[CompraOut], tags=["compras"])
def listar_compras(
    periodo: Rango = Depends(rango),
    solo_pendientes: bool = False,
    db: Session = Depends(get_db),
) -> list[CompraOut]:
    consulta = select(Compra).where(Compra.fecha >= periodo.desde, Compra.fecha <= periodo.hasta)
    if solo_pendientes:
        consulta = consulta.where(Compra.saldo > 0.01, Compra.estado == "activa")
    consulta = consulta.order_by(Compra.fecha.desc(), Compra.id.desc())
    return [_compra_out(c) for c in db.scalars(consulta).all()]


@router.get("/compras/{compra_id}", response_model=CompraDetalle, tags=["compras"])
def ver_compra(compra_id: int, db: Session = Depends(get_db)) -> CompraDetalle:
    compra = srv_compras.obtener(db, compra_id)
    dto = CompraDetalle.model_validate(compra)
    dto.proveedor_nombre = compra.proveedor.nombre if compra.proveedor else None
    dto.lineas = []
    for linea in compra.lineas:
        item = CompraLineaOut.model_validate(linea)
        item.producto_nombre = linea.producto.nombre if linea.producto else None
        item.sku = linea.producto.sku if linea.producto else None
        dto.lineas.append(item)
    return dto


@router.post("/compras", response_model=CreadoOut, status_code=201, tags=["compras"])
def crear_compra(datos: CompraIn, db: Session = Depends(get_db)) -> CreadoOut:
    compra = srv_compras.crear(db, datos)
    return CreadoOut(id=compra.id, numero=compra.numero)


@router.post("/compras/{compra_id}/anular", response_model=Ok, tags=["compras"])
def anular_compra(compra_id: int, db: Session = Depends(get_db)) -> Ok:
    srv_compras.anular(db, compra_id)
    return Ok()


# --------------------------------------------------------- ordenes de trabajo
def _orden_out(orden: Orden) -> OrdenOut:
    dto = OrdenOut.model_validate(orden)
    dto.cliente_nombre = orden.cliente.nombre if orden.cliente else None
    if orden.moto:
        dto.placa = orden.moto.placa
        dto.marca = orden.moto.marca
        dto.linea_moto = orden.moto.linea
    dto.total = srv_ordenes.total_orden(orden)
    return dto


@router.get("/ordenes", response_model=list[OrdenOut], tags=["ordenes"])
def listar_ordenes(
    estado: str | None = Query(None, description="abiertas | abierta | en_proceso | ..."),
    db: Session = Depends(get_db),
) -> list[OrdenOut]:
    consulta = select(Orden).order_by(Orden.fecha.desc(), Orden.id.desc()).limit(300)
    if estado == "abiertas":
        consulta = consulta.where(Orden.estado.in_(["abierta", "en_proceso", "terminada"]))
    elif estado:
        consulta = consulta.where(Orden.estado == estado)
    return [_orden_out(o) for o in db.scalars(consulta).all()]


@router.get("/ordenes/{orden_id}", response_model=OrdenDetalle, tags=["ordenes"])
def ver_orden(orden_id: int, db: Session = Depends(get_db)) -> OrdenDetalle:
    orden = srv_ordenes.obtener(db, orden_id)
    dto = OrdenDetalle.model_validate(orden)
    dto.cliente_nombre = orden.cliente.nombre if orden.cliente else None
    dto.telefono = orden.cliente.telefono if orden.cliente else None
    if orden.moto:
        dto.placa = orden.moto.placa
        dto.marca = orden.moto.marca
        dto.linea_moto = orden.moto.linea
        dto.modelo = orden.moto.modelo
    dto.total = srv_ordenes.total_orden(orden)
    dto.items = []
    for item in orden.items:
        salida = OrdenItemOut.model_validate(item)
        salida.stock = item.producto.stock if item.producto else None
        dto.items.append(salida)
    return dto


@router.post("/ordenes", response_model=CreadoOut, status_code=201, tags=["ordenes"])
def crear_orden(datos: OrdenIn, db: Session = Depends(get_db)) -> CreadoOut:
    orden = srv_ordenes.crear(db, datos)
    return CreadoOut(id=orden.id, numero=orden.numero)


@router.put("/ordenes/{orden_id}", response_model=CreadoOut, tags=["ordenes"])
def editar_orden(orden_id: int, datos: OrdenIn, db: Session = Depends(get_db)) -> CreadoOut:
    orden = srv_ordenes.actualizar(db, orden_id, datos)
    return CreadoOut(id=orden.id, numero=orden.numero)


@router.post("/ordenes/{orden_id}/facturar", response_model=CreadoOut, tags=["ordenes"])
def facturar_orden(
    orden_id: int, datos: FacturarOrdenIn, db: Session = Depends(get_db)
) -> CreadoOut:
    venta = srv_ordenes.facturar(db, orden_id, datos)
    return CreadoOut(id=venta.id, numero=venta.numero)


@router.delete("/ordenes/{orden_id}", response_model=Ok, tags=["ordenes"])
def anular_orden(orden_id: int, db: Session = Depends(get_db)) -> Ok:
    srv_ordenes.anular(db, orden_id)
    return Ok()


# -------------------------------------------------------------------- gastos
def _gasto_out(gasto: Gasto) -> GastoOut:
    dto = GastoOut.model_validate(gasto)
    dto.cuenta_codigo = gasto.cuenta.codigo
    dto.cuenta_nombre = gasto.cuenta.nombre
    dto.proveedor_nombre = gasto.proveedor.nombre if gasto.proveedor else None
    return dto


@router.get("/gastos", response_model=list[GastoOut], tags=["gastos"])
def listar_gastos(periodo: Rango = Depends(rango), db: Session = Depends(get_db)) -> list[GastoOut]:
    gastos = db.scalars(
        select(Gasto)
        .where(Gasto.fecha >= periodo.desde, Gasto.fecha <= periodo.hasta)
        .order_by(Gasto.fecha.desc(), Gasto.id.desc())
    ).all()
    return [_gasto_out(g) for g in gastos]


@router.post("/gastos", response_model=CreadoOut, status_code=201, tags=["gastos"])
def crear_gasto(datos: GastoIn, db: Session = Depends(get_db)) -> CreadoOut:
    gasto = srv_tesoreria.crear_gasto(db, datos)
    return CreadoOut(id=gasto.id)


@router.post("/gastos/{gasto_id}/anular", response_model=Ok, tags=["gastos"])
def anular_gasto(gasto_id: int, db: Session = Depends(get_db)) -> Ok:
    srv_tesoreria.anular_gasto(db, gasto_id)
    return Ok()


# ------------------------------------------------------------ cobros y pagos
@router.get("/pagos", response_model=list[PagoOut], tags=["tesoreria"])
def listar_pagos(periodo: Rango = Depends(rango), db: Session = Depends(get_db)) -> list[PagoOut]:
    pagos = db.scalars(
        select(Pago)
        .where(Pago.fecha >= periodo.desde, Pago.fecha <= periodo.hasta)
        .order_by(Pago.fecha.desc(), Pago.id.desc())
    ).all()
    salida = []
    for pago in pagos:
        dto = PagoOut.model_validate(pago)
        dto.tercero_nombre = pago.tercero.nombre if pago.tercero else None
        salida.append(dto)
    return salida


@router.post("/pagos", response_model=CreadoOut, status_code=201, tags=["tesoreria"])
def registrar_pago(datos: PagoIn, db: Session = Depends(get_db)) -> CreadoOut:
    pago = srv_tesoreria.registrar_pago(db, datos)
    return CreadoOut(id=pago.id)


@router.post("/traslados", response_model=CreadoOut, status_code=201, tags=["tesoreria"])
def traslado(datos: TrasladoIn, db: Session = Depends(get_db)) -> CreadoOut:
    asiento = srv_tesoreria.traslado(db, datos)
    return CreadoOut(id=asiento.id)


@router.post("/asientos", response_model=CreadoOut, status_code=201, tags=["contabilidad"])
def asiento_manual(datos: AsientoManualIn, db: Session = Depends(get_db)) -> CreadoOut:
    asiento = srv_tesoreria.asiento_manual(db, datos)
    return CreadoOut(id=asiento.id)
