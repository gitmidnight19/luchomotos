"""Datos de demostracion: 3 meses de operacion simulada del taller."""

from __future__ import annotations

import random
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .errores import ReglaNegocio
from .models import (
    Asiento,
    AsientoLinea,
    Categoria,
    Cuenta,
    Moto,
    Producto,
    Servicio,
    Tercero,
    Venta,
)
from .schemas import (
    CompraIn,
    CompraLineaIn,
    FacturarOrdenIn,
    GastoIn,
    OrdenIn,
    OrdenItemIn,
    PagoIn,
    TrasladoIn,
    VentaIn,
    VentaLineaIn,
)
from .services import compras as srv_compras
from .services import ordenes as srv_ordenes
from .services import tesoreria as srv_tesoreria
from .services import ventas as srv_ventas
from .services.contabilidad import registrar_asiento

# sku, nombre, categoria, costo, precio, minimo
PRODUCTOS = [
    ("AC-001", "Aceite motor 20W50 mineral 1L", "Lubricantes", 18000, 28000, 10),
    ("AC-002", "Aceite motor 10W40 sintetico 1L", "Lubricantes", 32000, 48000, 6),
    ("AC-003", "Aceite de transmision 350ml", "Lubricantes", 12000, 20000, 6),
    ("FL-001", "Filtro de aceite universal", "Filtros", 9000, 16000, 10),
    ("FL-002", "Filtro de aire deportivo", "Filtros", 25000, 42000, 5),
    ("FR-001", "Pastillas de freno delanteras", "Frenos", 22000, 38000, 8),
    ("FR-002", "Bandas de freno traseras", "Frenos", 18000, 32000, 8),
    ("FR-003", "Liquido de frenos DOT4 250ml", "Frenos", 11000, 19000, 6),
    ("MO-001", "Bujia NGK estandar", "Motor", 8000, 15000, 15),
    ("MO-002", "Empaque de culata", "Motor", 15000, 27000, 4),
    ("MO-003", "Kit de anillos 125cc", "Motor", 45000, 78000, 3),
    ("TR-001", "Kit de arrastre 428H", "Transmision", 95000, 155000, 4),
    ("TR-002", "Cadena 428 x 118L", "Transmision", 42000, 70000, 5),
    ("TR-003", "Guaya de embrague", "Transmision", 9000, 18000, 8),
    ("TR-004", "Guaya de acelerador", "Transmision", 9500, 18000, 8),
    ("EL-001", "Bateria 12V 5Ah sellada", "Electrico", 78000, 125000, 3),
    ("EL-002", "Bombillo halogeno H4", "Electrico", 12000, 22000, 10),
    ("EL-003", "CDI universal", "Electrico", 55000, 92000, 2),
    ("EL-004", "Regulador de voltaje", "Electrico", 48000, 82000, 3),
    ("LL-001", "Llanta 90/90-18 trasera", "Llantas", 115000, 185000, 4),
    ("LL-002", "Llanta 2.75-18 delantera", "Llantas", 95000, 155000, 4),
    ("LL-003", "Neumatico 18 pulgadas", "Llantas", 18000, 32000, 8),
    ("CA-001", "Espejo retrovisor par", "Carroceria", 22000, 40000, 5),
    ("CA-002", "Manubrio deportivo", "Carroceria", 38000, 65000, 3),
    ("AX-001", "Casco certificado", "Accesorios", 95000, 160000, 4),
    ("AX-002", "Guantes de moto", "Accesorios", 35000, 62000, 5),
]

CLIENTES = [
    ("Carlos Ramirez", "1032456789", "3104567890"),
    ("Ana Maria Torres", "52987654", "3209876543"),
    ("Jorge Luis Mejia", "80123456", "3115557788"),
    ("Diana Castillo", "1098765432", "3001234567"),
    ("Domicilios Rapidos SAS", "900456789-1", "6013334455"),
    ("Miguel Angel Ospina", "79456123", "3123456789"),
    ("Laura Gutierrez", "1015678234", "3187654321"),
    ("Ferney Alzate", "16789456", "3145556677"),
]

PROVEEDORES = [
    ("Distribuidora Moto Partes SAS", "900123456-7", "6012223344"),
    ("Lubricantes del Valle Ltda", "800987654-3", "6024445566"),
    ("Importadora de Llantas SA", "901234567-8", "6017778899"),
]

MOTOS = [
    ("ABC12D", "Bajaj", "Boxer CT 100", "2019", "100cc", "Negro"),
    ("XYZ45E", "Yamaha", "FZ 2.0", "2021", "150cc", "Azul"),
    ("QWE78F", "Honda", "CB 125F", "2020", "125cc", "Rojo"),
    ("RTY91G", "Suzuki", "Gixxer 150", "2022", "150cc", "Blanco"),
    ("PLM34H", "AKT", "NKD 125", "2018", "125cc", "Verde"),
    ("JKL56N", "Bajaj", "Pulsar NS 200", "2023", "200cc", "Naranja"),
    ("GHT77P", "Honda", "XR 150", "2021", "150cc", "Rojo"),
    ("VBN22Q", "Yamaha", "Crypton FI", "2020", "115cc", "Gris"),
]

GASTOS_FIJOS = [
    ("5120", "Arriendo del local", 1200000),
    ("5135", "Energia, agua e internet", 320000),
    ("5105", "Salario mecanico auxiliar", 1400000),
]

IVA = 19.0


def cargar(db: Session) -> None:
    """Genera 90 dias de operacion. Solo funciona sobre una base sin movimientos."""
    if db.scalar(select(func.count(Venta.id))):
        raise ReglaNegocio(
            "Ya existen movimientos registrados. Los datos de ejemplo solo se "
            "pueden cargar en una base vacia."
        )

    rnd = random.Random(7)
    hoy = datetime.now()
    inicio = hoy - timedelta(days=90)

    registrar_asiento(
        db,
        inicio.date(),
        "APERTURA",
        None,
        "Aporte inicial del propietario",
        [
            ("1105", 2000000, 0, "Efectivo en caja"),
            ("1110", 12000000, 0, "Cuenta bancaria"),
            ("1524", 4500000, 0, "Herramienta y equipo"),
            ("3105", 0, 18500000, "Capital social"),
        ],
    )

    categorias = {c.nombre: c.id for c in db.scalars(select(Categoria)).all()}
    ids: dict[str, int] = {}
    for sku, nombre, categoria, _costo, precio, minimo in PRODUCTOS:
        producto = Producto(
            sku=sku,
            nombre=nombre,
            categoria_id=categorias.get(categoria),
            unidad="UND",
            precio_venta=precio,
            stock_min=minimo,
        )
        db.add(producto)
        db.flush()
        ids[sku] = producto.id

    for nombre, doc, tel in CLIENTES:
        db.add(Tercero(tipo="cliente", nombre=nombre, documento=doc, telefono=tel))
    for nombre, doc, tel in PROVEEDORES:
        db.add(Tercero(tipo="proveedor", nombre=nombre, documento=doc, telefono=tel))
    db.flush()

    clientes = list(db.scalars(select(Tercero.id).where(Tercero.tipo == "cliente")).all())
    proveedores = list(db.scalars(select(Tercero.id).where(Tercero.tipo == "proveedor")).all())

    for i, (placa, marca, linea, modelo, cc, color) in enumerate(MOTOS):
        db.add(
            Moto(
                cliente_id=clientes[i % len(clientes)],
                placa=placa,
                marca=marca,
                linea=linea,
                modelo=modelo,
                cilindraje=cc,
                color=color,
            )
        )
    db.flush()
    motos = list(db.scalars(select(Moto)).all())

    # Surtido inicial de inventario
    srv_compras.crear(
        db,
        CompraIn(
            fecha=inicio.date(),
            proveedor_id=proveedores[0],
            forma_pago="contado",
            metodo="banco",
            nota="Surtido inicial",
            lineas=[
                CompraLineaIn(
                    producto_id=ids[p[0]],
                    cantidad=rnd.randint(8, 25),
                    costo_unit=p[3],
                    iva_pct=IVA,
                )
                for p in PRODUCTOS
            ],
        ),
    )

    servicios = list(db.scalars(select(Servicio)).all())
    productos = list(db.scalars(select(Producto)).all())
    cuentas = {c.codigo: c.id for c in db.scalars(select(Cuenta)).all()}
    ventas_credito: list[tuple[int, datetime]] = []

    for dia in range(90):
        momento = inicio + timedelta(days=dia)
        fecha = momento.date()
        if momento.weekday() == 6:
            continue

        if dia > 0 and dia % 21 == 0:
            bajos = list(
                db.scalars(select(Producto).where(Producto.stock <= Producto.stock_min + 3)).all()
            )
            reposicion: list[CompraLineaIn] = []
            for producto in bajos[:10]:
                base = next((x for x in PRODUCTOS if x[0] == producto.sku), None)
                if base:
                    reposicion.append(
                        CompraLineaIn(
                            producto_id=producto.id,
                            cantidad=rnd.randint(6, 15),
                            costo_unit=base[3],
                            iva_pct=IVA,
                        )
                    )
            if reposicion:
                srv_compras.crear(
                    db,
                    CompraIn(
                        fecha=fecha,
                        proveedor_id=rnd.choice(proveedores),
                        forma_pago="credito" if rnd.random() < 0.5 else "contado",
                        metodo="banco",
                        nota="Reposicion",
                        lineas=reposicion,
                    ),
                )

        for _ in range(rnd.randint(1, 5)):
            moto = rnd.choice(motos)
            lineas: list[VentaLineaIn] = []
            for _ in range(rnd.randint(1, 2)):
                servicio = rnd.choice(servicios)
                lineas.append(
                    VentaLineaIn(
                        tipo="servicio",
                        servicio_id=servicio.id,
                        descripcion=servicio.nombre,
                        cantidad=1,
                        precio_unit=servicio.precio,
                        iva_pct=IVA,
                    )
                )
            for _ in range(rnd.randint(0, 3)):
                producto = rnd.choice(productos)
                cantidad = rnd.randint(1, 2)
                actual = db.get(Producto, producto.id)
                if actual is None or actual.stock < cantidad:
                    continue
                lineas.append(
                    VentaLineaIn(
                        tipo="producto",
                        producto_id=producto.id,
                        descripcion=producto.nombre,
                        cantidad=cantidad,
                        precio_unit=producto.precio_venta,
                        iva_pct=IVA,
                    )
                )
            if not lineas:
                continue

            credito = rnd.random() < 0.12
            venta = srv_ventas.crear(
                db,
                VentaIn(
                    fecha=fecha,
                    cliente_id=moto.cliente_id,
                    moto_id=moto.id,
                    forma_pago="credito" if credito else "contado",
                    metodo="efectivo" if rnd.random() < 0.7 else "banco",
                    lineas=lineas,
                ),
            )
            if credito:
                ventas_credito.append((venta.id, momento))

        # Consignacion semanal del efectivo recaudado
        if momento.weekday() == 5:
            caja = (
                db.scalar(
                    select(func.coalesce(func.sum(AsientoLinea.debe - AsientoLinea.haber), 0.0))
                    .select_from(AsientoLinea)
                    .join(Asiento, Asiento.id == AsientoLinea.asiento_id)
                    .where(
                        AsientoLinea.cuenta_id == cuentas["1105"],
                        Asiento.anulado == 0,
                        Asiento.fecha <= fecha,
                    )
                )
                or 0
            )
            if caja > 1500000:
                srv_tesoreria.traslado(
                    db,
                    TrasladoIn(
                        fecha=fecha,
                        origen="efectivo",
                        destino="banco",
                        monto=round(caja - 800000, -3),
                        nota="Consignacion del recaudo semanal",
                    ),
                )

        if momento.day == 1:
            for codigo, descripcion, monto in GASTOS_FIJOS:
                srv_tesoreria.crear_gasto(
                    db,
                    GastoIn(
                        fecha=fecha,
                        cuenta_id=cuentas[codigo],
                        descripcion=descripcion,
                        monto=monto,
                        metodo="banco",
                    ),
                )
        if momento.day in (10, 20):
            srv_tesoreria.crear_gasto(
                db,
                GastoIn(
                    fecha=fecha,
                    cuenta_id=cuentas["5150"],
                    descripcion="Insumos de taller y aseo",
                    monto=rnd.randint(40000, 120000),
                    metodo="efectivo",
                ),
            )

    # Cobros de cartera
    for venta_id, momento in ventas_credito:
        pendiente = db.get(Venta, venta_id)
        if pendiente and pendiente.saldo > 0 and rnd.random() < 0.6:
            pago = momento + timedelta(days=rnd.randint(5, 25))
            if pago <= hoy:
                srv_tesoreria.registrar_pago(
                    db,
                    PagoIn(
                        fecha=pago.date(),
                        clase="cobro",
                        doc_id=venta_id,
                        monto=pendiente.saldo,
                        metodo="efectivo",
                    ),
                )

    # Pagos a proveedores
    from .models import Compra

    for compra in db.scalars(select(Compra).where(Compra.saldo > 0)).all():
        if rnd.random() < 0.65:
            srv_tesoreria.registrar_pago(
                db,
                PagoIn(
                    fecha=hoy.date(),
                    clase="pago",
                    doc_id=compra.id,
                    monto=compra.saldo,
                    metodo="banco",
                ),
            )

    # Una orden de trabajo abierta y otra ya terminada
    moto = motos[0]
    srv_ordenes.crear(
        db,
        OrdenIn(
            fecha=hoy.date(),
            cliente_id=moto.cliente_id,
            moto_id=moto.id,
            km=24500,
            estado="en_proceso",
            mecanico="Andres",
            diagnostico="Ruido en tren delantero y frenos desgastados",
            items=[
                OrdenItemIn(
                    tipo="servicio",
                    servicio_id=servicios[2].id,
                    descripcion=servicios[2].nombre,
                    cantidad=1,
                    precio_unit=servicios[2].precio,
                    iva_pct=IVA,
                ),
                OrdenItemIn(
                    tipo="producto",
                    producto_id=ids["FR-001"],
                    descripcion="Pastillas de freno delanteras",
                    cantidad=1,
                    precio_unit=38000,
                    iva_pct=IVA,
                ),
            ],
        ),
    )
    db.commit()


__all__ = ["FacturarOrdenIn", "cargar"]
