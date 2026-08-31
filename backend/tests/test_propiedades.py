"""Propiedades del motor contable, verificadas con secuencias generadas.

No son casos de prueba escritos a mano: Hypothesis modela el taller como una
maquina de estados, genera cientos de secuencias aleatorias de operaciones
reales (comprar, vender, cobrar, anular, ajustar) y comprueba los invariantes
**despues de cada paso**. Un fallo viene acompanado de la secuencia minima que
lo reproduce.

Los invariantes son la especificacion ejecutable del sistema: si alguno se
rompe, la contabilidad esta mal, sin importar que las pruebas de ejemplo pasen.
"""

from __future__ import annotations

import os
import tempfile

# La configuracion se lee al importar la app.
os.environ.setdefault("TALLER_DATA_DIR", tempfile.mkdtemp(prefix="taller-prop-"))

from datetime import date

import pytest
from hypothesis import HealthCheck, settings
from hypothesis import strategies as st
from hypothesis.stateful import (
    Bundle,
    RuleBasedStateMachine,
    invariant,
    rule,
)
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.errores import ReglaNegocio
from app.models import (
    Asiento,
    AsientoLinea,
    Compra,
    Cuenta,
    Kardex,
    Pago,
    Producto,
    Tercero,
    Venta,
)
from app.schemas import (
    CompraIn,
    CompraLineaIn,
    GastoIn,
    PagoIn,
    VentaIn,
    VentaLineaIn,
)
from app.seed import sembrar
from app.services import compras as srv_compras
from app.services import inventario as srv_inventario
from app.services import tesoreria as srv_tesoreria
from app.services import ventas as srv_ventas
from app.services.contabilidad import balance_general

FECHA = date(2026, 6, 15)

# Rangos realistas del negocio: contraejemplos legibles en vez de 1e-308.
dinero = st.integers(min_value=100, max_value=2_000_000)
cantidad = st.integers(min_value=1, max_value=50)
iva = st.sampled_from([0.0, 5.0, 19.0])


class TallerEnOperacion(RuleBasedStateMachine):
    """Un taller al que se le aplican operaciones reales, en cualquier orden."""

    productos: Bundle = Bundle("productos")
    ventas: Bundle = Bundle("ventas")
    compras: Bundle = Bundle("compras")

    def __init__(self) -> None:
        super().__init__()
        # SQLite en memoria: Hypothesis corre cientos de secuencias y el disco
        # lo haria inviable. StaticPool mantiene una sola conexion, que es lo
        # que hace que la base sobreviva entre sesiones del mismo motor.
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        sembrar(self.db)
        self.cuentas = {c.codigo: c.id for c in self.db.scalars(select(Cuenta)).all()}
        cliente = Tercero(tipo="cliente", nombre="Cliente de prueba")
        self.db.add(cliente)
        self.db.flush()
        self.cliente_id = cliente.id
        proveedor = Tercero(tipo="proveedor", nombre="Proveedor de prueba")
        self.db.add(proveedor)
        self.db.flush()
        self.proveedor_id = proveedor.id

    def teardown(self) -> None:
        self.db.close()
        self.engine.dispose()

    # ------------------------------------------------------------- operaciones
    @rule(target=productos, precio=dinero, minimo=st.integers(0, 10))
    def crear_producto(self, precio: int, minimo: int) -> int:
        producto = Producto(
            nombre=f"Repuesto {len(self.bundle('productos'))}",
            precio_venta=precio,
            stock_min=minimo,
        )
        self.db.add(producto)
        self.db.flush()
        return producto.id

    @rule(
        target=compras,
        producto=productos,
        unidades=cantidad,
        costo=dinero,
        pct=iva,
        credito=st.booleans(),
    )
    def comprar(self, producto: int, unidades: int, costo: int, pct: float, credito: bool) -> int:
        compra = srv_compras.crear(
            self.db,
            CompraIn(
                fecha=FECHA,
                forma_pago="credito" if credito else "contado",
                proveedor_id=self.proveedor_id if credito else None,
                metodo="banco",
                lineas=[
                    CompraLineaIn(
                        producto_id=producto, cantidad=unidades, costo_unit=costo, iva_pct=pct
                    )
                ],
            ),
        )
        return compra.id

    @rule(
        target=ventas,
        producto=productos,
        unidades=cantidad,
        precio=dinero,
        pct=iva,
        credito=st.booleans(),
    )
    def vender(
        self, producto: int, unidades: int, precio: int, pct: float, credito: bool
    ) -> int | None:
        try:
            venta = srv_ventas.crear(
                self.db,
                VentaIn(
                    fecha=FECHA,
                    cliente_id=self.cliente_id if credito else None,
                    forma_pago="credito" if credito else "contado",
                    metodo="efectivo",
                    lineas=[
                        VentaLineaIn(
                            tipo="producto",
                            producto_id=producto,
                            cantidad=unidades,
                            precio_unit=precio,
                            iva_pct=pct,
                        )
                    ],
                ),
            )
            return venta.id
        except ReglaNegocio:
            # Sin existencias: el rechazo es el comportamiento correcto.
            return None

    @rule(precio=dinero, pct=iva)
    def vender_servicio(self, precio: int, pct: float) -> None:
        srv_ventas.crear(
            self.db,
            VentaIn(
                fecha=FECHA,
                forma_pago="contado",
                metodo="efectivo",
                lineas=[
                    VentaLineaIn(
                        tipo="servicio",
                        descripcion="Mano de obra",
                        cantidad=1,
                        precio_unit=precio,
                        iva_pct=pct,
                    )
                ],
            ),
        )

    @rule(venta=ventas, pct_abono=st.integers(10, 100))
    def cobrar(self, venta: int | None, pct_abono: int) -> None:
        if venta is None:
            return
        factura = self.db.get(Venta, venta)
        if factura is None or factura.saldo <= 0:
            return
        monto = round(factura.saldo * pct_abono / 100, 2)
        if monto <= 0:
            return
        srv_tesoreria.registrar_pago(
            self.db,
            PagoIn(fecha=FECHA, clase="cobro", doc_id=venta, monto=monto, metodo="efectivo"),
        )

    @rule(compra=compras, pct_abono=st.integers(10, 100))
    def pagar(self, compra: int, pct_abono: int) -> None:
        factura = self.db.get(Compra, compra)
        if factura is None or factura.saldo <= 0:
            return
        monto = round(factura.saldo * pct_abono / 100, 2)
        if monto <= 0:
            return
        srv_tesoreria.registrar_pago(
            self.db,
            PagoIn(fecha=FECHA, clase="pago", doc_id=compra, monto=monto, metodo="banco"),
        )

    @rule(monto=dinero, codigo=st.sampled_from(["5120", "5135", "5145", "5150"]))
    def registrar_gasto(self, monto: int, codigo: str) -> None:
        srv_tesoreria.crear_gasto(
            self.db,
            GastoIn(fecha=FECHA, cuenta_id=self.cuentas[codigo], monto=monto, metodo="efectivo"),
        )

    @rule(producto=productos, delta=st.integers(-5, 5))
    def ajustar_inventario(self, producto: int, delta: int) -> None:
        actual = self.db.get(Producto, producto)
        if actual is None or actual.stock + delta < 0:
            return
        srv_inventario.ajustar(
            self.db, producto, cantidad=delta, modo="delta", fecha=FECHA, nota="Ajuste generado"
        )

    @rule(venta=ventas)
    def anular_venta(self, venta: int | None) -> None:
        if venta is None:
            return
        factura = self.db.get(Venta, venta)
        if factura is None or factura.estado != "activa":
            return
        srv_ventas.anular(self.db, venta)

    # ------------------------------------------------------------- invariantes
    @invariant()
    def i1_cada_asiento_cuadra(self) -> None:
        """Todo asiento del libro cumple debe = haber, exactamente."""
        for asiento in self.db.scalars(select(Asiento)).all():
            debe = sum(linea.debe for linea in asiento.lineas)
            haber = sum(linea.haber for linea in asiento.lineas)
            assert debe == haber, (
                f"Asiento {asiento.id} ({asiento.doc_tipo}) descuadrado: "
                f"debe {debe} contra haber {haber}"
            )

    @invariant()
    def i2_la_ecuacion_contable_se_sostiene(self) -> None:
        """Activo = Pasivo + Patrimonio."""
        balance = balance_general(self.db, FECHA)
        assert balance["diferencia"] == 0, f"Descuadre de {balance['diferencia']}"

    @invariant()
    def i3_el_kardex_explica_la_existencia(self) -> None:
        """La suma de movimientos de cada repuesto es su existencia actual."""
        for producto in self.db.scalars(select(Producto)).all():
            movido = self.db.scalar(
                select(func.coalesce(func.sum(Kardex.cantidad), 0.0)).where(
                    Kardex.producto_id == producto.id
                )
            )
            assert abs(movido - producto.stock) < 1e-9, (
                f"Repuesto {producto.id}: el kardex suma {movido} pero el stock dice "
                f"{producto.stock}"
            )

    @invariant()
    def i4_la_cuenta_de_control_ata_con_el_inventario(self) -> None:
        """El saldo de 1435 es el valor del inventario segun el auxiliar.

        Este es el invariante que la implementacion con `float` rompe: se
        contabiliza el costo redondeado de cada salida, pero el auxiliar
        conserva `stock * costo_promedio`, y ambos divergen.
        """
        contable = self.db.scalar(
            select(func.coalesce(func.sum(AsientoLinea.debe - AsientoLinea.haber), 0.0))
            .select_from(AsientoLinea)
            .join(Asiento, Asiento.id == AsientoLinea.asiento_id)
            .join(Cuenta, Cuenta.id == AsientoLinea.cuenta_id)
            .where(Cuenta.codigo == "1435", Asiento.anulado == 0)
        )
        auxiliar = sum(p.stock * p.costo_promedio for p in self.db.scalars(select(Producto)).all())
        assert abs(contable - auxiliar) < 0.005, (
            f"La cuenta 1435 marca {contable:.4f} pero el inventario vale "
            f"{auxiliar:.4f} (desviacion {contable - auxiliar:.4f})"
        )

    @invariant()
    def i5_los_totales_de_la_factura_cuadran(self) -> None:
        """total = subtotal + iva, sin arrastre de redondeo."""
        for venta in self.db.scalars(select(Venta)).all():
            assert venta.total == venta.subtotal + venta.iva, (
                f"Venta {venta.numero}: total {venta.total} contra "
                f"subtotal+iva {venta.subtotal + venta.iva}"
            )

    @invariant()
    def i6_los_abonos_explican_el_saldo(self) -> None:
        """Para cada factura activa: abonos + saldo pendiente = total."""
        for venta in self.db.scalars(select(Venta).where(Venta.estado == "activa")).all():
            abonado = self.db.scalar(
                select(func.coalesce(func.sum(Pago.monto), 0.0)).where(
                    Pago.doc_tipo == "VENTA", Pago.doc_id == venta.id
                )
            )
            if venta.forma_pago != "credito":
                continue  # al contado se recauda todo en el acto
            assert abs(abonado + venta.saldo - venta.total) < 0.005, (
                f"Venta {venta.numero}: abonos {abonado} + saldo {venta.saldo} "
                f"contra total {venta.total}"
            )


# Tres invariantes fallan contra la implementacion con `float`, y Hypothesis los
# encontro en los primeros pasos generados:
#
#   I1  debe == haber      ->  449714.09 == 449714.08999999997
#   I4  1435 == auxiliar   ->  la cuenta de control se desvia 1.700 del inventario
#   I5  total == sub+iva   ->  142362.08 == 119632.0 + 22730.08
#
# `strict=True` hace que la prueba falle si algun dia PASA sin quitar el marcador:
# cuando el refactor a centavos enteros aterrice, esto obliga a borrar esta linea.
pytestmark = pytest.mark.xfail(
    strict=True,
    reason="Los importes son float: los invariantes exactos no se sostienen. "
    "Se levanta con el refactor a centavos enteros.",
)

TallerEnOperacion.TestCase.settings = settings(
    max_examples=30,
    stateful_step_count=15,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.filter_too_much],
)

TestTallerEnOperacion = TallerEnOperacion.TestCase
