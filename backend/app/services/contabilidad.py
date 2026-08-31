"""Motor contable: partida doble, saldos y estados financieros.

Ninguna operacion del taller escribe asientos a mano: todas pasan por
`registrar_asiento`, que valida la ecuacion contable antes de guardar.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from ..errores import NoEncontrado, ReglaNegocio
from ..models import Asiento, AsientoLinea, Cuenta

#: Grupos cuya naturaleza es deudora. El signo del saldo sigue la naturaleza del
#: GRUPO y no la de la cuenta, para que las cuentas de contrapartida
#: (depreciacion acumulada, devoluciones en ventas) resten dentro de su grupo.
GRUPOS_DEUDORES = ("ACTIVO", "COSTO", "GASTO")

Movimiento = tuple[str, float, float, str | None]


def r2(x: float | int | None) -> float:
    return round(float(x or 0), 2)


# --------------------------------------------------------------- utilidades
def cfg(db: Session, clave: str, defecto: str | None = None) -> str | None:
    from ..models import Config

    fila = db.get(Config, clave)
    return fila.valor if fila else defecto


def cuenta_por_codigo(db: Session, codigo: str) -> Cuenta:
    cuenta = db.scalar(select(Cuenta).where(Cuenta.codigo == codigo))
    if cuenta is None:
        raise NoEncontrado(f"Cuenta contable no encontrada: {codigo}")
    return cuenta


def cuenta_medio(db: Session, metodo: str | None) -> str:
    """Cuenta de efectivo segun el medio de pago (caja o banco)."""
    if metodo == "banco":
        return cfg(db, "cuenta_banco", "1110") or "1110"
    return cfg(db, "cuenta_caja", "1105") or "1105"


def iva_general(db: Session) -> float:
    try:
        return float(cfg(db, "iva_pct", "0") or 0)
    except ValueError:
        return 0.0


# ---------------------------------------------------------------- asientos
def registrar_asiento(
    db: Session,
    fecha: date,
    doc_tipo: str,
    doc_id: int | None,
    descripcion: str,
    movimientos: list[Movimiento],
) -> Asiento | None:
    """Guarda un asiento. `movimientos` son tuplas (codigo_cuenta, debe, haber, detalle).

    Devuelve None si todos los movimientos son cero. Lanza `ReglaNegocio` si el
    asiento queda descuadrado.
    """
    limpios: list[tuple[Cuenta, float, float, str | None]] = []
    total_debe = total_haber = 0.0
    for codigo, debe, haber, detalle in movimientos:
        debe, haber = r2(debe), r2(haber)
        if debe == 0 and haber == 0:
            continue
        limpios.append((cuenta_por_codigo(db, codigo), debe, haber, detalle))
        total_debe += debe
        total_haber += haber

    if not limpios:
        return None
    if abs(r2(total_debe) - r2(total_haber)) > 0.05:
        raise ReglaNegocio(
            f"Asiento descuadrado: debe {total_debe:.2f} contra haber {total_haber:.2f}"
        )

    asiento = Asiento(
        fecha=fecha, doc_tipo=doc_tipo, doc_id=doc_id, descripcion=descripcion, anulado=0
    )
    for cuenta, debe, haber, detalle in limpios:
        asiento.lineas.append(
            AsientoLinea(cuenta_id=cuenta.id, debe=debe, haber=haber, detalle=detalle)
        )
    db.add(asiento)
    db.flush()
    return asiento


def anular_asientos(db: Session, doc_tipo: str, doc_id: int, fecha: date, motivo: str) -> None:
    """Genera el contra-asiento de un documento y marca el original como anulado."""
    asientos = db.scalars(
        select(Asiento).where(
            Asiento.doc_tipo == doc_tipo, Asiento.doc_id == doc_id, Asiento.anulado == 0
        )
    ).all()
    for asiento in asientos:
        movs: list[Movimiento] = [
            (linea.cuenta.codigo, linea.haber, linea.debe, f"Reversion: {linea.detalle or ''}")
            for linea in asiento.lineas
        ]
        registrar_asiento(db, fecha, f"{doc_tipo}-ANUL", doc_id, motivo, movs)
        asiento.anulado = 1
    db.flush()


# ------------------------------------------------------------------ saldos
def saldos_por_cuenta(
    db: Session,
    desde: date | None = None,
    hasta: date | None = None,
    solo_movimiento: bool = True,
) -> list[dict]:
    condiciones = [Asiento.anulado == 0]
    if desde:
        condiciones.append(Asiento.fecha >= desde)
    if hasta:
        condiciones.append(Asiento.fecha <= hasta)

    consulta = (
        select(
            Cuenta.id,
            Cuenta.codigo,
            Cuenta.nombre,
            Cuenta.tipo,
            Cuenta.naturaleza,
            func.coalesce(func.sum(AsientoLinea.debe), 0.0).label("debe"),
            func.coalesce(func.sum(AsientoLinea.haber), 0.0).label("haber"),
        )
        .select_from(Cuenta)
        .join(AsientoLinea, AsientoLinea.cuenta_id == Cuenta.id, isouter=True)
        .join(
            Asiento,
            and_(Asiento.id == AsientoLinea.asiento_id, *condiciones),
            isouter=True,
        )
        .group_by(Cuenta.id)
        .order_by(Cuenta.codigo)
    )

    salida: list[dict] = []
    for fila in db.execute(consulta).mappings():
        debe, haber = r2(fila["debe"]), r2(fila["haber"])
        if solo_movimiento and debe == 0 and haber == 0:
            continue
        neto = debe - haber
        salida.append(
            {
                "id": fila["id"],
                "codigo": fila["codigo"],
                "nombre": fila["nombre"],
                "tipo": fila["tipo"],
                "naturaleza": fila["naturaleza"],
                "debe": debe,
                "haber": haber,
                "saldo": r2(neto if fila["tipo"] in GRUPOS_DEUDORES else -neto),
            }
        )
    return salida


def estado_resultados(db: Session, desde: date, hasta: date) -> dict:
    saldos = saldos_por_cuenta(db, desde, hasta)
    ingresos = [s for s in saldos if s["tipo"] == "INGRESO"]
    costos = [s for s in saldos if s["tipo"] == "COSTO"]
    gastos = [s for s in saldos if s["tipo"] == "GASTO"]
    total_ingresos = r2(sum(s["saldo"] for s in ingresos))
    total_costos = r2(sum(s["saldo"] for s in costos))
    total_gastos = r2(sum(s["saldo"] for s in gastos))
    bruta = r2(total_ingresos - total_costos)
    neta = r2(bruta - total_gastos)
    return {
        "desde": desde,
        "hasta": hasta,
        "ingresos": ingresos,
        "costos": costos,
        "gastos": gastos,
        "total_ingresos": total_ingresos,
        "total_costos": total_costos,
        "total_gastos": total_gastos,
        "utilidad_bruta": bruta,
        "utilidad_neta": neta,
        "margen_bruto": r2(bruta / total_ingresos * 100) if total_ingresos else 0.0,
        "margen_neto": r2(neta / total_ingresos * 100) if total_ingresos else 0.0,
    }


def balance_general(db: Session, hasta: date) -> dict:
    saldos = saldos_por_cuenta(db, None, hasta)
    activos = [s for s in saldos if s["tipo"] == "ACTIVO"]
    pasivos = [s for s in saldos if s["tipo"] == "PASIVO"]
    patrimonio = [s for s in saldos if s["tipo"] == "PATRIMONIO"]

    inicio = cfg(db, "inicio_ejercicio") or f"{hasta.year}-01-01"
    resultados = estado_resultados(db, date.fromisoformat(inicio), hasta)

    total_activos = r2(sum(s["saldo"] for s in activos))
    total_pasivos = r2(sum(s["saldo"] for s in pasivos))
    total_patrimonio = r2(sum(s["saldo"] for s in patrimonio) + resultados["utilidad_neta"])
    return {
        "hasta": hasta,
        "activos": activos,
        "pasivos": pasivos,
        "patrimonio": patrimonio,
        "utilidad_ejercicio": resultados["utilidad_neta"],
        "total_activos": total_activos,
        "total_pasivos": total_pasivos,
        "total_patrimonio": total_patrimonio,
        "diferencia": r2(total_activos - total_pasivos - total_patrimonio),
    }


def libro_mayor(db: Session, cuenta_id: int, desde: date, hasta: date) -> dict:
    cuenta = db.get(Cuenta, cuenta_id)
    if cuenta is None:
        raise NoEncontrado("Cuenta no encontrada")

    anterior = db.execute(
        select(
            func.coalesce(func.sum(AsientoLinea.debe), 0.0),
            func.coalesce(func.sum(AsientoLinea.haber), 0.0),
        )
        .select_from(AsientoLinea)
        .join(Asiento, Asiento.id == AsientoLinea.asiento_id)
        .where(AsientoLinea.cuenta_id == cuenta_id, Asiento.anulado == 0, Asiento.fecha < desde)
    ).one()

    signo = 1 if cuenta.naturaleza == "D" else -1
    saldo = r2((anterior[0] - anterior[1]) * signo)
    saldo_inicial = saldo

    filas = db.execute(
        select(
            Asiento.fecha,
            Asiento.doc_tipo,
            Asiento.doc_id,
            Asiento.descripcion,
            AsientoLinea.debe,
            AsientoLinea.haber,
            AsientoLinea.detalle,
        )
        .select_from(AsientoLinea)
        .join(Asiento, Asiento.id == AsientoLinea.asiento_id)
        .where(
            AsientoLinea.cuenta_id == cuenta_id,
            Asiento.anulado == 0,
            Asiento.fecha >= desde,
            Asiento.fecha <= hasta,
        )
        .order_by(Asiento.fecha, Asiento.id)
    ).mappings()

    movimientos = []
    for fila in filas:
        saldo = r2(saldo + (fila["debe"] - fila["haber"]) * signo)
        movimientos.append({**dict(fila), "saldo": saldo})

    return {
        "cuenta": {
            "id": cuenta.id,
            "codigo": cuenta.codigo,
            "nombre": cuenta.nombre,
            "tipo": cuenta.tipo,
            "naturaleza": cuenta.naturaleza,
        },
        "saldo_inicial": saldo_inicial,
        "saldo_final": saldo,
        "movimientos": movimientos,
    }
