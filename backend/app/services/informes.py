"""Informes gerenciales y contables."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from ..database import hoy
from ..models import (
    Asiento,
    AsientoLinea,
    Compra,
    Cuenta,
    Orden,
    Producto,
    Tercero,
    Venta,
    VentaLinea,
)
from .contabilidad import cfg, estado_resultados, saldos_por_cuenta


def _suma(db: Session, columna, *filtros) -> int:
    """Suma de una columna monetaria, en centavos."""
    return int(db.scalar(select(func.coalesce(func.sum(columna), 0)).where(*filtros)) or 0)


def dashboard(db: Session) -> dict:
    hoy_ = hoy()
    inicio_mes = hoy_.replace(day=1)
    inicio_anio = date.fromisoformat(cfg(db, "inicio_ejercicio") or f"{hoy_.year}-01-01")
    activa = Venta.estado == "activa"

    ventas_hoy = _suma(db, Venta.total, activa, Venta.fecha == hoy_)
    ventas_mes = _suma(db, Venta.total, activa, Venta.fecha >= inicio_mes, Venta.fecha <= hoy_)
    costo_mes = _suma(db, Venta.costo_total, activa, Venta.fecha >= inicio_mes, Venta.fecha <= hoy_)
    num_ventas_mes = (
        db.scalar(
            select(func.count(Venta.id)).where(
                activa, Venta.fecha >= inicio_mes, Venta.fecha <= hoy_
            )
        )
        or 0
    )

    er_mes = estado_resultados(db, inicio_mes, hoy_)
    er_anio = estado_resultados(db, inicio_anio, hoy_)

    saldos = {s["codigo"]: s["saldo"] for s in saldos_por_cuenta(db, None, hoy_)}
    caja = saldos.get(cfg(db, "cuenta_caja", "1105") or "1105", 0)
    banco = saldos.get(cfg(db, "cuenta_banco", "1110") or "1110", 0)

    cxc = _suma(db, Venta.saldo, activa, Venta.saldo > 0)
    cxp = _suma(db, Compra.saldo, Compra.estado == "activa", Compra.saldo > 0)
    # El valor del inventario se lee del auxiliar, no se recalcula: es
    # exactamente el mismo entero que sostiene la cuenta de control 1435.
    inv_costo = _suma(db, Producto.valor_inventario, Producto.activo == 1)
    inv_venta = int(
        db.scalar(
            select(func.coalesce(func.sum(Producto.stock * Producto.precio_venta), 0)).where(
                Producto.activo == 1
            )
        )
        or 0
    )

    bajo_stock = [
        {
            "id": p.id,
            "sku": p.sku,
            "nombre": p.nombre,
            "stock": round(p.stock, 4),
            "stock_min": round(p.stock_min, 4),
            "precio_venta": p.precio_venta,
        }
        for p in db.scalars(
            select(Producto)
            .where(Producto.activo == 1, Producto.stock <= Producto.stock_min)
            .order_by(Producto.stock - Producto.stock_min)
            .limit(20)
        ).all()
    ]

    ordenes_abiertas = (
        db.scalar(
            select(func.count(Orden.id)).where(
                Orden.estado.in_(["abierta", "en_proceso", "terminada"])
            )
        )
        or 0
    )

    # Serie de 30 dias en una sola consulta, rellenando los dias sin ventas.
    desde = hoy_ - timedelta(days=29)
    agrupado = {
        fila["fecha"]: fila
        for fila in db.execute(
            select(
                Venta.fecha.label("fecha"),
                func.sum(Venta.total).label("ventas"),
                func.sum(Venta.costo_total).label("costo"),
            )
            .where(activa, Venta.fecha >= desde, Venta.fecha <= hoy_)
            .group_by(Venta.fecha)
        ).mappings()
    }
    serie = []
    for i in range(30):
        dia = desde + timedelta(days=i)
        fila = agrupado.get(dia)
        v = int(fila["ventas"]) if fila else 0
        c = int(fila["costo"]) if fila else 0
        serie.append({"fecha": dia, "ventas": v, "costo": c, "margen": v - c})

    top_productos = [
        {"nombre": f["nombre"], "cant": round(f["cant"], 4), "monto": int(f["monto"])}
        for f in db.execute(
            select(
                Producto.nombre.label("nombre"),
                func.sum(VentaLinea.cantidad).label("cant"),
                func.sum(VentaLinea.subtotal).label("monto"),
            )
            .join(Venta, and_(Venta.id == VentaLinea.venta_id, activa))
            .join(Producto, Producto.id == VentaLinea.producto_id)
            .where(Venta.fecha >= inicio_mes, Venta.fecha <= hoy_)
            .group_by(Producto.id)
            .order_by(func.sum(VentaLinea.subtotal).desc())
            .limit(8)
        ).mappings()
    ]

    top_servicios = [
        {"nombre": f["nombre"], "cant": round(f["cant"], 4), "monto": int(f["monto"])}
        for f in db.execute(
            select(
                VentaLinea.descripcion.label("nombre"),
                func.sum(VentaLinea.cantidad).label("cant"),
                func.sum(VentaLinea.subtotal).label("monto"),
            )
            .join(Venta, and_(Venta.id == VentaLinea.venta_id, activa))
            .where(VentaLinea.tipo == "servicio", Venta.fecha >= inicio_mes, Venta.fecha <= hoy_)
            .group_by(VentaLinea.descripcion)
            .order_by(func.sum(VentaLinea.subtotal).desc())
            .limit(8)
        ).mappings()
    ]

    return {
        "fecha": hoy_,
        "ventas_hoy": ventas_hoy,
        "ventas_mes": ventas_mes,
        "num_ventas_mes": num_ventas_mes,
        "ticket_promedio": round(ventas_mes / num_ventas_mes) if num_ventas_mes else 0,
        "costo_mes": costo_mes,
        "utilidad_bruta_mes": er_mes["utilidad_bruta"],
        "utilidad_neta_mes": er_mes["utilidad_neta"],
        "gastos_mes": er_mes["total_gastos"],
        "margen_mes": er_mes["margen_neto"],
        "utilidad_anio": er_anio["utilidad_neta"],
        "ingresos_anio": er_anio["total_ingresos"],
        "caja": caja,
        "banco": banco,
        "efectivo_total": caja + banco,
        "cxc": cxc,
        "cxp": cxp,
        "inventario_valor": inv_costo,
        "inventario_venta": inv_venta,
        "num_bajo_stock": len(bajo_stock),
        "ordenes_abiertas": ordenes_abiertas,
        "bajo_stock": bajo_stock,
        "serie": serie,
        "top_productos": top_productos,
        "top_servicios": top_servicios,
    }


def cartera(db: Session) -> dict:
    hoy_ = hoy()

    def dias(fecha: date) -> int:
        return (hoy_ - fecha).days

    por_cobrar: list[dict[str, Any]] = [
        {
            "id": v.id,
            "numero": v.numero,
            "fecha": v.fecha,
            "tercero": v.cliente.nombre if v.cliente else None,
            "telefono": v.cliente.telefono if v.cliente else None,
            "dias": dias(v.fecha),
            "total": v.total,
            "saldo": v.saldo,
        }
        for v in db.scalars(
            select(Venta).where(Venta.estado == "activa", Venta.saldo > 0.01).order_by(Venta.fecha)
        ).all()
    ]
    por_pagar: list[dict[str, Any]] = [
        {
            "id": c.id,
            "numero": c.numero,
            "fecha": c.fecha,
            "tercero": c.proveedor.nombre if c.proveedor else None,
            "telefono": c.proveedor.telefono if c.proveedor else None,
            "dias": dias(c.fecha),
            "total": c.total,
            "saldo": c.saldo,
        }
        for c in db.scalars(
            select(Compra)
            .where(Compra.estado == "activa", Compra.saldo > 0.01)
            .order_by(Compra.fecha)
        ).all()
    ]
    return {
        "por_cobrar": por_cobrar,
        "por_pagar": por_pagar,
        "total_cobrar": sum(x["saldo"] for x in por_cobrar),
        "total_pagar": sum(x["saldo"] for x in por_pagar),
    }


def inventario_valorizado(db: Session) -> dict:
    items: list[dict[str, Any]] = []
    for p in db.scalars(
        select(Producto).where(Producto.activo == 1).order_by(Producto.nombre)
    ).all():
        # El valor al costo se lee del auxiliar; no se recalcula desde el promedio.
        valor_costo = p.valor_inventario
        valor_venta = round(p.stock * p.precio_venta)
        items.append(
            {
                "id": p.id,
                "sku": p.sku,
                "nombre": p.nombre,
                "categoria_id": p.categoria_id,
                "categoria_nombre": p.categoria.nombre if p.categoria else None,
                "unidad": p.unidad,
                "stock": round(p.stock, 4),
                "costo_promedio": p.costo_promedio,
                "precio_venta": p.precio_venta,
                "stock_min": round(p.stock_min, 4),
                "ubicacion": p.ubicacion,
                "iva_pct": p.iva_pct,
                "activo": p.activo,
                "valor_costo": valor_costo,
                "valor_venta": valor_venta,
                "utilidad_pot": valor_venta - valor_costo,
                "margen": round((p.precio_venta - p.costo_promedio) / p.precio_venta * 100, 2)
                if p.precio_venta
                else 0.0,
            }
        )
    return {
        "items": items,
        "total_costo": sum(i["valor_costo"] for i in items),
        "total_venta": sum(i["valor_venta"] for i in items),
        "unidades": round(sum(i["stock"] for i in items), 4),
    }


def ventas_periodo(db: Session, desde: date, hasta: date, agrupar: str = "dia") -> list[dict]:
    formato = {"dia": "%Y-%m-%d", "mes": "%Y-%m", "anio": "%Y"}.get(agrupar, "%Y-%m-%d")
    periodo = func.strftime(formato, Venta.fecha).label("periodo")
    filas = db.execute(
        select(
            periodo,
            func.count(Venta.id).label("num"),
            func.sum(Venta.subtotal).label("subtotal"),
            func.sum(Venta.iva).label("iva"),
            func.sum(Venta.total).label("total"),
            func.sum(Venta.costo_total).label("costo"),
        )
        .where(Venta.estado == "activa", Venta.fecha >= desde, Venta.fecha <= hasta)
        .group_by(periodo)
        .order_by(periodo)
    ).mappings()

    salida: list[dict[str, Any]] = []
    for f in filas:
        subtotal = int(f["subtotal"])
        costo = int(f["costo"])
        utilidad = subtotal - costo
        salida.append(
            {
                "periodo": f["periodo"],
                "num": f["num"],
                "subtotal": subtotal,
                "iva": int(f["iva"]),
                "total": int(f["total"]),
                "costo": costo,
                "utilidad": utilidad,
                "margen": round(utilidad / subtotal * 100, 2) if subtotal else 0.0,
            }
        )
    return salida


def flujo_caja(db: Session, desde: date, hasta: date) -> dict:
    caja = cfg(db, "cuenta_caja", "1105") or "1105"
    banco = cfg(db, "cuenta_banco", "1110") or "1110"
    cuentas = (caja, banco)

    saldo_inicial = int(
        db.scalar(
            select(func.coalesce(func.sum(AsientoLinea.debe - AsientoLinea.haber), 0.0))
            .select_from(AsientoLinea)
            .join(Asiento, Asiento.id == AsientoLinea.asiento_id)
            .join(Cuenta, Cuenta.id == AsientoLinea.cuenta_id)
            .where(Cuenta.codigo.in_(cuentas), Asiento.fecha < desde)
        )
        or 0
    )

    filas = db.execute(
        select(
            Asiento.id,
            Asiento.fecha,
            Asiento.doc_tipo,
            Asiento.descripcion,
            func.sum(AsientoLinea.debe).label("entra"),
            func.sum(AsientoLinea.haber).label("sale"),
        )
        .select_from(AsientoLinea)
        .join(Asiento, Asiento.id == AsientoLinea.asiento_id)
        .join(Cuenta, Cuenta.id == AsientoLinea.cuenta_id)
        .where(
            Cuenta.codigo.in_(cuentas),
            Asiento.fecha >= desde,
            Asiento.fecha <= hasta,
        )
        .group_by(Asiento.id)
        .order_by(Asiento.fecha, Asiento.id)
    ).mappings()

    saldo = saldo_inicial
    movimientos: list[dict[str, Any]] = []
    for f in filas:
        entra, sale = int(f["entra"]), int(f["sale"])
        saldo = saldo + entra - sale
        movimientos.append(
            {
                "fecha": f["fecha"],
                "doc_tipo": f["doc_tipo"],
                "descripcion": f["descripcion"],
                "entra": entra,
                "sale": sale,
                "saldo": saldo,
            }
        )
    return {
        "saldo_inicial": saldo_inicial,
        "saldo_final": saldo,
        "total_entradas": sum(m["entra"] for m in movimientos),
        "total_salidas": sum(m["sale"] for m in movimientos),
        "movimientos": movimientos,
    }


def libro_diario(db: Session, desde: date, hasta: date) -> list[dict]:
    asientos = db.scalars(
        select(Asiento)
        .where(Asiento.fecha >= desde, Asiento.fecha <= hasta)
        .order_by(Asiento.fecha, Asiento.id)
    ).all()
    salida = []
    for a in asientos:
        lineas: list[dict[str, Any]] = [
            {
                "codigo": linea.cuenta.codigo,
                "nombre": linea.cuenta.nombre,
                "debe": linea.debe,
                "haber": linea.haber,
                "detalle": linea.detalle,
            }
            for linea in sorted(a.lineas, key=lambda x: -x.debe)
        ]
        salida.append(
            {
                "id": a.id,
                "fecha": a.fecha,
                "doc_tipo": a.doc_tipo,
                "doc_id": a.doc_id,
                "descripcion": a.descripcion,
                "anulado": a.anulado,
                "total": sum(x["debe"] for x in lineas),
                "lineas": lineas,
            }
        )
    return salida


def balance_prueba(db: Session, desde: date, hasta: date) -> dict:
    filas = saldos_por_cuenta(db, desde, hasta)
    return {
        "filas": filas,
        "total_debe": sum(f["debe"] for f in filas),
        "total_haber": sum(f["haber"] for f in filas),
    }


def impuestos(db: Session, desde: date, hasta: date) -> dict:
    saldos = {s["codigo"]: s["saldo"] for s in saldos_por_cuenta(db, desde, hasta)}
    generado = saldos.get("2408", 0)
    descontable = saldos.get("1665", 0)
    return {
        "desde": desde,
        "hasta": hasta,
        "iva_generado": generado,
        "iva_descontable": descontable,
        "saldo_a_pagar": generado - descontable,
    }


def buscar(db: Session, texto: str) -> dict:
    patron = f"%{texto}%"
    productos = db.scalars(
        select(Producto)
        .where(
            Producto.activo == 1,
            (Producto.nombre.ilike(patron)) | (func.coalesce(Producto.sku, "").ilike(patron)),
        )
        .limit(15)
    ).all()
    clientes = db.scalars(
        select(Tercero)
        .where(
            Tercero.activo == 1,
            (Tercero.nombre.ilike(patron))
            | (func.coalesce(Tercero.documento, "").ilike(patron))
            | (func.coalesce(Tercero.telefono, "").ilike(patron)),
        )
        .limit(15)
    ).all()
    return {"productos": productos, "clientes": clientes}


def saldo_terceros(db: Session):
    """Saldos por cobrar y por pagar de cada tercero, en una sola consulta."""
    deuda = (
        select(Venta.cliente_id.label("tid"), func.sum(Venta.saldo).label("monto"))
        .where(Venta.estado == "activa")
        .group_by(Venta.cliente_id)
        .subquery()
    )
    pordar = (
        select(Compra.proveedor_id.label("tid"), func.sum(Compra.saldo).label("monto"))
        .where(Compra.estado == "activa")
        .group_by(Compra.proveedor_id)
        .subquery()
    )
    return (
        select(
            Tercero,
            func.coalesce(deuda.c.monto, 0.0).label("deuda"),
            func.coalesce(pordar.c.monto, 0.0).label("pordar"),
        )
        .join(deuda, deuda.c.tid == Tercero.id, isouter=True)
        .join(pordar, pordar.c.tid == Tercero.id, isouter=True)
    )


__all__ = [
    "balance_prueba",
    "buscar",
    "cartera",
    "dashboard",
    "flujo_caja",
    "impuestos",
    "inventario_valorizado",
    "libro_diario",
    "saldo_terceros",
    "ventas_periodo",
]
