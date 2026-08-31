"""Servidor MCP del taller: preguntarle al negocio en lenguaje natural.

Cinco herramientas escritas a mano, no generadas del OpenAPI. La documentacion
de FastMCP lo advierte de forma explicita: los modelos rinden bastante peor con
APIs auto-convertidas que con servidores disenados a proposito. Convertir los
~40 endpoints CRUD daria mas superficie y peores respuestas; lo que sirve es un
punado de preguntas de negocio bien planteadas.

**Solo lectura.** No hay ninguna herramienta que escriba: un modelo no debe
poder anular una factura ni tocar el libro. La superficie de escritura sigue
siendo la app.

Se ejecuta en proceso contra la capa de servicios, sin pasar por HTTP: no hay
autenticacion que resolver ni un segundo salto de red.

    uv run --directory backend fastmcp dev mcp_taller.py
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from fastmcp import FastMCP
from sqlalchemy import func, select

from app.database import SessionLocal, hoy
from app.models import Producto, Venta, VentaLinea
from app.services import informes
from app.services.contabilidad import balance_general, cfg, estado_resultados

mcp = FastMCP(
    name="Taller Contable",
    instructions=(
        "Consultas sobre la contabilidad de un taller de motos: ventas, "
        "rentabilidad, inventario, cartera y estados financieros. Todos los "
        "importes se devuelven en PESOS, ya convertidos desde los centavos que "
        "guarda la base. Es un servidor de solo lectura."
    ),
)


def _pesos(centavos: int | float | None) -> float:
    """Los importes viajan en centavos; para leerlos se muestran en pesos."""
    return round((centavos or 0) / 100, 2)


def _rango(desde: str | None, hasta: str | None) -> tuple[date, date]:
    fin = date.fromisoformat(hasta) if hasta else hoy()
    inicio = date.fromisoformat(desde) if desde else fin.replace(day=1)
    return inicio, fin


@mcp.tool
def resumen_periodo(desde: str | None = None, hasta: str | None = None) -> dict[str, Any]:
    """Como le fue al taller en un periodo: ventas, costo, gastos y utilidad.

    Args:
        desde: fecha inicial AAAA-MM-DD. Por defecto, el dia 1 del mes de `hasta`.
        hasta: fecha final AAAA-MM-DD. Por defecto, hoy.
    """
    inicio, fin = _rango(desde, hasta)
    with SessionLocal() as db:
        er = estado_resultados(db, inicio, fin)
        facturas = db.scalar(
            select(func.count(Venta.id)).where(
                Venta.estado == "activa", Venta.fecha >= inicio, Venta.fecha <= fin
            )
        )
        facturado = db.scalar(
            select(func.coalesce(func.sum(Venta.total), 0)).where(
                Venta.estado == "activa", Venta.fecha >= inicio, Venta.fecha <= fin
            )
        )
        return {
            "periodo": {"desde": inicio.isoformat(), "hasta": fin.isoformat()},
            "facturas_emitidas": facturas or 0,
            "facturado_con_iva": _pesos(facturado),
            "ingresos_sin_iva": _pesos(er["total_ingresos"]),
            "costo_de_ventas": _pesos(er["total_costos"]),
            "utilidad_bruta": _pesos(er["utilidad_bruta"]),
            "gastos": _pesos(er["total_gastos"]),
            "utilidad_neta": _pesos(er["utilidad_neta"]),
            "margen_neto_pct": er["margen_neto"],
            "ticket_promedio": _pesos((facturado or 0) / facturas) if facturas else 0.0,
        }


@mcp.tool
def repuestos_por_reponer() -> dict[str, Any]:
    """Que repuestos estan bajo el minimo, con cuanto se venden y cuanto cuesta reponerlos."""
    with SessionLocal() as db:
        bajos = db.scalars(
            select(Producto)
            .where(Producto.activo == 1, Producto.stock <= Producto.stock_min)
            .order_by(Producto.stock - Producto.stock_min)
        ).all()

        desde = hoy() - timedelta(days=90)
        vendido = {
            fila.producto_id: fila.unidades
            for fila in db.execute(
                select(
                    VentaLinea.producto_id,
                    func.sum(VentaLinea.cantidad).label("unidades"),
                )
                .join(Venta, Venta.id == VentaLinea.venta_id)
                .where(Venta.estado == "activa", Venta.fecha >= desde)
                .group_by(VentaLinea.producto_id)
            ).all()
        }

        items = []
        for p in bajos:
            por_dia = (vendido.get(p.id, 0) or 0) / 90
            items.append(
                {
                    "sku": p.sku,
                    "nombre": p.nombre,
                    "existencia": p.stock,
                    "minimo": p.stock_min,
                    "faltan_para_el_minimo": round(p.stock_min - p.stock, 2),
                    "precio_venta": _pesos(p.precio_venta),
                    "costo_unitario": _pesos(p.costo_promedio),
                    "dias_de_cobertura": round(p.stock / por_dia, 1) if por_dia else None,
                    "vendidos_ultimos_90_dias": round(vendido.get(p.id, 0) or 0, 2),
                }
            )
        return {
            "cuantos": len(items),
            "nota": "dias_de_cobertura es null cuando no hubo ventas en 90 dias",
            "repuestos": items,
        }


@mcp.tool
def rentabilidad_por_producto(
    top: int = 10, desde: str | None = None, hasta: str | None = None
) -> dict[str, Any]:
    """Que repuestos dejan plata de verdad: ingreso, costo, utilidad y margen.

    Args:
        top: cuantos devolver, ordenados por utilidad. Maximo 50.
        desde: fecha inicial AAAA-MM-DD.
        hasta: fecha final AAAA-MM-DD.
    """
    inicio, fin = _rango(desde, hasta)
    with SessionLocal() as db:
        filas = db.execute(
            select(
                Producto.sku,
                Producto.nombre,
                func.sum(VentaLinea.cantidad).label("unidades"),
                func.sum(VentaLinea.subtotal).label("ingreso"),
                func.sum(VentaLinea.costo_total).label("costo"),
            )
            .join(Venta, Venta.id == VentaLinea.venta_id)
            .join(Producto, Producto.id == VentaLinea.producto_id)
            .where(Venta.estado == "activa", Venta.fecha >= inicio, Venta.fecha <= fin)
            .group_by(Producto.id)
            .order_by((func.sum(VentaLinea.subtotal) - func.sum(VentaLinea.costo_total)).desc())
            .limit(min(max(top, 1), 50))
        ).all()

        productos = []
        for f in filas:
            utilidad = (f.ingreso or 0) - (f.costo or 0)
            productos.append(
                {
                    "sku": f.sku,
                    "nombre": f.nombre,
                    "unidades_vendidas": round(f.unidades or 0, 2),
                    "ingreso": _pesos(f.ingreso),
                    "costo": _pesos(f.costo),
                    "utilidad": _pesos(utilidad),
                    "margen_pct": round(utilidad / f.ingreso * 100, 1) if f.ingreso else 0.0,
                }
            )
        return {
            "periodo": {"desde": inicio.isoformat(), "hasta": fin.isoformat()},
            "productos": productos,
        }


@mcp.tool
def cartera_vencida(dias_min: int = 0) -> dict[str, Any]:
    """Quien le debe al taller y desde hace cuanto, mas lo que el taller debe.

    Args:
        dias_min: solo facturas con al menos estos dias de antiguedad.
    """
    with SessionLocal() as db:
        datos = informes.cartera(db)

        def limpiar(filas: list[dict]) -> list[dict]:
            return [
                {
                    "documento": f["numero"],
                    "tercero": f["tercero"],
                    "telefono": f["telefono"],
                    "fecha": f["fecha"].isoformat(),
                    "dias": f["dias"],
                    "total": _pesos(f["total"]),
                    "saldo_pendiente": _pesos(f["saldo"]),
                }
                for f in filas
                if f["dias"] >= dias_min
            ]

        por_cobrar = limpiar(datos["por_cobrar"])
        por_pagar = limpiar(datos["por_pagar"])
        return {
            "por_cobrar": {
                "total": round(sum(f["saldo_pendiente"] for f in por_cobrar), 2),
                "facturas": por_cobrar,
            },
            "por_pagar": {
                "total": round(sum(f["saldo_pendiente"] for f in por_pagar), 2),
                "compras": por_pagar,
            },
        }


@mcp.tool
def estado_financiero(corte: str | None = None) -> dict[str, Any]:
    """Foto completa: efectivo, inventario, cartera, patrimonio y cuadre contable.

    Args:
        corte: fecha de corte AAAA-MM-DD. Por defecto, hoy.
    """
    fin = date.fromisoformat(corte) if corte else hoy()
    with SessionLocal() as db:
        balance = balance_general(db, fin)
        inventario = informes.inventario_valorizado(db)
        saldos = {c["codigo"]: c["saldo"] for c in balance["activos"] + balance["pasivos"]}
        return {
            "corte": fin.isoformat(),
            "empresa": cfg(db, "empresa", "Taller"),
            "efectivo": {
                "caja": _pesos(saldos.get("1105", 0)),
                "banco": _pesos(saldos.get("1110", 0)),
            },
            "inventario": {
                "al_costo": _pesos(inventario["total_costo"]),
                "a_precio_de_venta": _pesos(inventario["total_venta"]),
                "referencias": len(inventario["items"]),
            },
            "por_cobrar": _pesos(saldos.get("1305", 0)),
            "por_pagar": _pesos(saldos.get("2205", 0)),
            "iva_por_pagar": _pesos(saldos.get("2408", 0) - saldos.get("1665", 0)),
            "totales": {
                "activos": _pesos(balance["total_activos"]),
                "pasivos": _pesos(balance["total_pasivos"]),
                "patrimonio": _pesos(balance["total_patrimonio"]),
                "utilidad_del_ejercicio": _pesos(balance["utilidad_ejercicio"]),
            },
            # Debe ser 0. Si no lo es, la contabilidad tiene un problema y hay
            # que decirlo, no maquillarlo.
            "descuadre": _pesos(balance["diferencia"]),
        }


if __name__ == "__main__":
    mcp.run()
