"""Dependencias compartidas por los routers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from .database import get_db, hoy

DB = Depends(get_db)


@dataclass(slots=True)
class Rango:
    desde: date
    hasta: date


def rango(
    desde: date | None = Query(None, description="Inicio del periodo (por defecto, dia 1 del mes)"),
    hasta: date | None = Query(None, description="Fin del periodo (por defecto, hoy)"),
) -> Rango:
    fin = hasta or hoy()
    return Rango(desde=desde or fin.replace(day=1), hasta=fin)


__all__ = ["DB", "Rango", "Session", "rango"]
