"""Informes gerenciales y estados financieros."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db, hoy
from ..deps import Rango, rango
from ..schemas import (
    AsientoOut,
    BalanceGeneral,
    BalancePrueba,
    Cartera,
    Dashboard,
    EstadoResultados,
    FlujoCaja,
    Impuestos,
    InventarioValorizado,
    LibroMayor,
    SaldoCuenta,
    VentaPeriodo,
)
from ..services import contabilidad, informes

router = APIRouter(prefix="/informes", tags=["informes"])


@router.get("/dashboard", response_model=Dashboard, summary="Panel de control del taller")
def dashboard(db: Session = Depends(get_db)) -> dict:
    return informes.dashboard(db)


@router.get("/estado-resultados", response_model=EstadoResultados)
def estado_resultados(periodo: Rango = Depends(rango), db: Session = Depends(get_db)) -> dict:
    return contabilidad.estado_resultados(db, periodo.desde, periodo.hasta)


@router.get("/balance", response_model=BalanceGeneral)
def balance(hasta: date | None = None, db: Session = Depends(get_db)) -> dict:
    return contabilidad.balance_general(db, hasta or hoy())


@router.get("/balance-prueba", response_model=BalancePrueba)
def balance_prueba(periodo: Rango = Depends(rango), db: Session = Depends(get_db)) -> dict:
    return informes.balance_prueba(db, periodo.desde, periodo.hasta)


@router.get("/libro-diario", response_model=list[AsientoOut])
def libro_diario(periodo: Rango = Depends(rango), db: Session = Depends(get_db)) -> list[dict]:
    return informes.libro_diario(db, periodo.desde, periodo.hasta)


@router.get("/libro-mayor/{cuenta_id}", response_model=LibroMayor)
def libro_mayor(
    cuenta_id: int, periodo: Rango = Depends(rango), db: Session = Depends(get_db)
) -> dict:
    return contabilidad.libro_mayor(db, cuenta_id, periodo.desde, periodo.hasta)


@router.get("/saldos", response_model=list[SaldoCuenta])
def saldos(periodo: Rango = Depends(rango), db: Session = Depends(get_db)) -> list[dict]:
    return contabilidad.saldos_por_cuenta(db, periodo.desde, periodo.hasta)


@router.get("/cartera", response_model=Cartera, summary="Por cobrar y por pagar")
def cartera(db: Session = Depends(get_db)) -> dict:
    return informes.cartera(db)


@router.get("/inventario", response_model=InventarioValorizado)
def inventario(db: Session = Depends(get_db)) -> dict:
    return informes.inventario_valorizado(db)


@router.get("/ventas", response_model=list[VentaPeriodo])
def ventas_periodo(
    periodo: Rango = Depends(rango),
    agrupar: str = Query("dia", pattern="^(dia|mes|anio)$"),
    db: Session = Depends(get_db),
) -> list[dict]:
    return informes.ventas_periodo(db, periodo.desde, periodo.hasta, agrupar)


@router.get("/flujo", response_model=FlujoCaja, summary="Flujo de caja y bancos")
def flujo(periodo: Rango = Depends(rango), db: Session = Depends(get_db)) -> dict:
    return informes.flujo_caja(db, periodo.desde, periodo.hasta)


@router.get("/impuestos", response_model=Impuestos)
def impuestos(periodo: Rango = Depends(rango), db: Session = Depends(get_db)) -> dict:
    return informes.impuestos(db, periodo.desde, periodo.hasta)
