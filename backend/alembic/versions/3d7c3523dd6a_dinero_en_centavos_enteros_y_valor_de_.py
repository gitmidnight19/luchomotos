"""dinero en centavos enteros y valor de inventario

Convierte todas las columnas monetarias de REAL (pesos) a INTEGER (centavos) y
sustituye `productos.costo_promedio` por `productos.valor_inventario`.

El valor del inventario se recalcula como `ROUND(stock * costo_promedio * 100)`.
No coincidira al centavo con el saldo historico de la cuenta 1435, precisamente
porque esa desviacion es el defecto que este cambio corrige; el ajuste queda
como una diferencia de apertura y se documenta en el informe posterior.

Revision ID: 3d7c3523dd6a
Revises: cd33d98fa14a
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3d7c3523dd6a"
down_revision: str | Sequence[str] | None = "cd33d98fa14a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# tabla -> columnas monetarias que pasan de pesos a centavos
MONETARIAS: dict[str, tuple[str, ...]] = {
    "asiento_lineas": ("debe", "haber"),
    "productos": ("precio_venta",),
    "servicios": ("precio",),
    "kardex": ("costo_unit", "costo_total", "saldo_costo", "saldo_unit"),
    "compras": ("subtotal", "iva", "total", "saldo"),
    "compra_lineas": ("costo_unit", "subtotal"),
    "orden_items": ("precio_unit",),
    "ventas": ("subtotal", "descuento", "iva", "total", "costo_total", "saldo"),
    "venta_lineas": ("precio_unit", "descuento", "subtotal", "costo_unit", "costo_total"),
    "gastos": ("monto",),
    "pagos": ("monto",),
}


def upgrade() -> None:
    # 1. Los importes se escalan ANTES de cambiar el tipo: hacerlo despues
    #    truncaria a pesos enteros y se perderian los centavos.
    for tabla, columnas in MONETARIAS.items():
        asignaciones = ", ".join(
            f"{c} = CAST(ROUND(COALESCE({c}, 0) * 100) AS INTEGER)" for c in columnas
        )
        op.execute(f"UPDATE {tabla} SET {asignaciones}")

    for tabla, columnas in MONETARIAS.items():
        with op.batch_alter_table(tabla) as batch:
            for columna in columnas:
                batch.alter_column(
                    columna, existing_type=sa.Float(), type_=sa.Integer(), existing_nullable=False
                )

    # 2. El costo promedio deja de almacenarse: se guarda el valor total.
    with op.batch_alter_table("productos") as batch:
        batch.add_column(sa.Column("valor_inventario", sa.Integer(), nullable=False, default=0,
                                   server_default="0"))
    op.execute(
        "UPDATE productos SET valor_inventario = "
        "CAST(ROUND(COALESCE(stock, 0) * COALESCE(costo_promedio, 0) * 100) AS INTEGER)"
    )
    with op.batch_alter_table("productos") as batch:
        batch.drop_column("costo_promedio")


def downgrade() -> None:
    with op.batch_alter_table("productos") as batch:
        batch.add_column(sa.Column("costo_promedio", sa.Float(), nullable=False,
                                   server_default="0"))
    op.execute(
        "UPDATE productos SET costo_promedio = "
        "CASE WHEN stock > 0 THEN valor_inventario / 100.0 / stock ELSE 0 END"
    )
    with op.batch_alter_table("productos") as batch:
        batch.drop_column("valor_inventario")

    for tabla, columnas in MONETARIAS.items():
        with op.batch_alter_table(tabla) as batch:
            for columna in columnas:
                batch.alter_column(
                    columna, existing_type=sa.Integer(), type_=sa.Float(), existing_nullable=False
                )
        asignaciones = ", ".join(f"{c} = COALESCE({c}, 0) / 100.0" for c in columnas)
        op.execute(f"UPDATE {tabla} SET {asignaciones}")
