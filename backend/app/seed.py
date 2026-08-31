"""Datos iniciales: plan de cuentas, configuracion, categorias y servicios."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Categoria, Config, Cuenta, Servicio

# codigo, nombre, tipo, naturaleza
PLAN_CUENTAS: list[tuple[str, str, str, str]] = [
    ("1105", "Caja general", "ACTIVO", "D"),
    ("1110", "Bancos", "ACTIVO", "D"),
    ("1305", "Clientes - Cuentas por cobrar", "ACTIVO", "D"),
    ("1435", "Inventario de repuestos", "ACTIVO", "D"),
    ("1455", "Inventario en consignacion", "ACTIVO", "D"),
    ("1524", "Herramienta y equipo de taller", "ACTIVO", "D"),
    ("1592", "Depreciacion acumulada", "ACTIVO", "C"),
    ("1665", "IVA descontable", "ACTIVO", "D"),
    ("2105", "Obligaciones financieras", "PASIVO", "C"),
    ("2205", "Proveedores - Cuentas por pagar", "PASIVO", "C"),
    ("2335", "Costos y gastos por pagar", "PASIVO", "C"),
    ("2367", "Anticipos de clientes", "PASIVO", "C"),
    ("2408", "IVA generado por pagar", "PASIVO", "C"),
    ("2505", "Salarios por pagar", "PASIVO", "C"),
    ("3105", "Capital social", "PATRIMONIO", "C"),
    ("3605", "Utilidad del ejercicio", "PATRIMONIO", "C"),
    ("3705", "Resultados de ejercicios anteriores", "PATRIMONIO", "C"),
    ("4135", "Ingresos por venta de repuestos", "INGRESO", "C"),
    ("4140", "Ingresos por servicios de taller", "INGRESO", "C"),
    ("4175", "Devoluciones y descuentos en ventas", "INGRESO", "D"),
    ("4210", "Otros ingresos", "INGRESO", "C"),
    ("5105", "Gastos de personal / nomina", "GASTO", "D"),
    ("5110", "Honorarios y servicios contratados", "GASTO", "D"),
    ("5120", "Arrendamiento del local", "GASTO", "D"),
    ("5125", "Seguros", "GASTO", "D"),
    ("5135", "Servicios publicos (agua, luz, internet)", "GASTO", "D"),
    ("5140", "Mantenimiento y reparaciones", "GASTO", "D"),
    ("5145", "Transporte y combustible", "GASTO", "D"),
    ("5150", "Papeleria y elementos de aseo", "GASTO", "D"),
    ("5155", "Publicidad y mercadeo", "GASTO", "D"),
    ("5160", "Impuestos y contribuciones", "GASTO", "D"),
    ("5195", "Depreciacion", "GASTO", "D"),
    ("5199", "Gastos diversos", "GASTO", "D"),
    ("5305", "Gastos financieros e intereses", "GASTO", "D"),
    ("6135", "Costo de repuestos vendidos", "COSTO", "D"),
    ("6140", "Costo de mano de obra", "COSTO", "D"),
    ("6150", "Faltantes y perdidas de inventario", "COSTO", "D"),
]

CATEGORIAS = [
    "Lubricantes",
    "Frenos",
    "Motor",
    "Transmision",
    "Electrico",
    "Llantas",
    "Filtros",
    "Carroceria",
    "Accesorios",
    "Otros",
]

# codigo, nombre, precio EN CENTAVOS, duracion en minutos
SERVICIOS: list[tuple[str, str, int, int]] = [
    ("S001", "Cambio de aceite", 2500000, 30),
    ("S002", "Sincronizacion / afinado", 6000000, 90),
    ("S003", "Ajuste y limpieza de frenos", 3500000, 45),
    ("S004", "Cambio de guayas", 2000000, 30),
    ("S005", "Ajuste de cadena y kit de arrastre", 2500000, 40),
    ("S006", "Revision electrica general", 4500000, 60),
    ("S007", "Mantenimiento preventivo completo", 12000000, 180),
    ("S008", "Montaje de llanta", 1500000, 20),
    ("S009", "Diagnostico general", 2000000, 30),
    ("S010", "Mano de obra por hora", 3000000, 60),
]


def config_defecto() -> dict[str, str]:
    return {
        "empresa": "Taller de Motos",
        "nit": "",
        "direccion": "",
        "telefono": "",
        "moneda": "$",
        "decimales": "0",
        "iva_pct": "19",
        "prefijo_venta": "FV-",
        "prefijo_compra": "FC-",
        "prefijo_orden": "OT-",
        "cuenta_caja": "1105",
        "cuenta_banco": "1110",
        "inicio_ejercicio": datetime.now().strftime("%Y-01-01"),
    }


def sembrar(db: Session) -> None:
    """Inserta los datos base que falten. Es idempotente."""
    existentes = set(db.scalars(select(Cuenta.codigo)).all())
    for codigo, nombre, tipo, naturaleza in PLAN_CUENTAS:
        if codigo not in existentes:
            db.add(
                Cuenta(
                    codigo=codigo,
                    nombre=nombre,
                    tipo=tipo,
                    naturaleza=naturaleza,
                    movimiento=1,
                    sistema=1,
                )
            )

    claves = set(db.scalars(select(Config.clave)).all())
    for clave, valor in config_defecto().items():
        if clave not in claves:
            db.add(Config(clave=clave, valor=valor))

    categorias = set(db.scalars(select(Categoria.nombre)).all())
    for nombre in CATEGORIAS:
        if nombre not in categorias:
            db.add(Categoria(nombre=nombre))

    codigos = set(db.scalars(select(Servicio.codigo)).all())
    for codigo, nombre, precio, duracion in SERVICIOS:
        if codigo not in codigos:
            db.add(Servicio(codigo=codigo, nombre=nombre, precio=precio, duracion_min=duracion))

    db.commit()
