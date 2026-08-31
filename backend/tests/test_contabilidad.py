"""Pruebas del motor contable: partida doble, costo promedio y anulaciones."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.errores import ReglaNegocio
from app.services.contabilidad import balance_general, registrar_asiento, saldos_por_cuenta


def saldo(cliente: TestClient, codigo: str) -> float:
    for fila in cliente.get("/api/informes/saldos?desde=2000-01-01").json():
        if fila["codigo"] == codigo:
            return fila["saldo"]
    return 0.0


# --------------------------------------------------------------- partida doble
def test_asiento_descuadrado_es_rechazado(db):
    with pytest.raises(ReglaNegocio, match="descuadrado"):
        registrar_asiento(
            db,
            __import__("datetime").date(2026, 1, 1),
            "MANUAL",
            None,
            "Prueba",
            [("1105", 100, 0, "entra"), ("4210", 0, 90, "sale")],
        )


def test_asiento_sin_movimientos_no_se_guarda(db):
    from datetime import date

    resultado = registrar_asiento(
        db, date(2026, 1, 1), "MANUAL", None, "Vacio", [("1105", 0, 0, None)]
    )
    assert resultado is None


def test_cuenta_de_contrapartida_resta_en_su_grupo(cliente: TestClient, db):
    """La depreciacion acumulada (activo de naturaleza credito) debe restar."""
    cuentas = {c["codigo"]: c["id"] for c in cliente.get("/api/cuentas").json()}
    respuesta = cliente.post(
        "/api/asientos",
        json={
            "descripcion": "Depreciacion mensual",
            "lineas": [
                {"cuenta_id": cuentas["5195"], "debe": 80000, "detalle": "gasto"},
                {"cuenta_id": cuentas["1592"], "haber": 80000, "detalle": "acumulada"},
            ],
        },
    )
    assert respuesta.status_code == 201, respuesta.text

    balance = balance_general(db, __import__("datetime").date.today())
    depreciacion = next(a for a in balance["activos"] if a["codigo"] == "1592")
    assert depreciacion["saldo"] == -80000
    assert balance["diferencia"] == 0


# ------------------------------------------------------------------- ventas
def test_venta_contado_contabiliza_y_descarga_inventario(cliente: TestClient, producto):
    respuesta = cliente.post(
        "/api/ventas",
        json={
            "forma_pago": "contado",
            "metodo": "efectivo",
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 2,
                    "precio_unit": 20000,
                    "iva_pct": 19,
                }
            ],
        },
    )
    assert respuesta.status_code == 201, respuesta.text
    venta = cliente.get(f"/api/ventas/{respuesta.json()['id']}").json()

    assert venta["subtotal"] == 40000
    assert venta["iva"] == 7600
    assert venta["total"] == 47600
    assert venta["costo_total"] == 20000  # 2 unidades al costo promedio de 10.000

    inventario = cliente.get("/api/productos").json()[0]
    assert inventario["stock"] == 8

    assert saldo(cliente, "1105") == 47600  # caja
    assert saldo(cliente, "4135") == 40000  # ingresos por repuestos
    assert saldo(cliente, "2408") == 7600  # IVA generado
    assert saldo(cliente, "6135") == 20000  # costo de ventas
    assert saldo(cliente, "1435") == 80000  # inventario restante


def test_venta_servicio_va_a_su_propia_cuenta(cliente: TestClient):
    servicio = cliente.get("/api/servicios").json()[0]
    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "servicio",
                    "servicio_id": servicio["id"],
                    "cantidad": 1,
                    "precio_unit": 50000,
                    "iva_pct": 0,
                }
            ]
        },
    )
    assert saldo(cliente, "4140") == 50000
    assert saldo(cliente, "4135") == 0


def test_venta_sin_stock_es_rechazada(cliente: TestClient, producto):
    respuesta = cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 999,
                    "precio_unit": 20000,
                }
            ]
        },
    )
    assert respuesta.status_code == 400
    assert "Stock insuficiente" in respuesta.json()["detail"]
    assert cliente.get("/api/productos").json()[0]["stock"] == 10  # no se toco nada


def test_venta_a_credito_exige_cliente(cliente: TestClient, producto):
    respuesta = cliente.post(
        "/api/ventas",
        json={
            "forma_pago": "credito",
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 1,
                    "precio_unit": 20000,
                }
            ],
        },
    )
    assert respuesta.status_code == 400
    assert "credito requiere cliente" in respuesta.json()["detail"]


def test_venta_a_credito_genera_cartera(cliente: TestClient, producto, cliente_taller):
    cliente.post(
        "/api/ventas",
        json={
            "forma_pago": "credito",
            "cliente_id": cliente_taller["id"],
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 1,
                    "precio_unit": 20000,
                    "iva_pct": 0,
                }
            ],
        },
    )
    cartera = cliente.get("/api/informes/cartera").json()
    assert cartera["total_cobrar"] == 20000
    assert saldo(cliente, "1305") == 20000
    assert saldo(cliente, "1105") == 0


def test_anular_venta_devuelve_inventario_y_reversa(cliente: TestClient, producto):
    venta = cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 3,
                    "precio_unit": 20000,
                    "iva_pct": 19,
                }
            ]
        },
    ).json()

    assert cliente.post(f"/api/ventas/{venta['id']}/anular").status_code == 200
    assert cliente.get(f"/api/ventas/{venta['id']}").json()["estado"] == "anulada"
    assert cliente.get("/api/productos").json()[0]["stock"] == 10
    assert saldo(cliente, "1105") == 0
    assert saldo(cliente, "4135") == 0
    assert saldo(cliente, "1435") == 100000


def test_no_se_puede_anular_dos_veces(cliente: TestClient, producto):
    venta = cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 1,
                    "precio_unit": 20000,
                }
            ]
        },
    ).json()
    cliente.post(f"/api/ventas/{venta['id']}/anular")
    segunda = cliente.post(f"/api/ventas/{venta['id']}/anular")
    assert segunda.status_code == 400


# ------------------------------------------------------- costo promedio
def test_costo_promedio_ponderado(cliente: TestClient, producto):
    """10 u. a 10.000 mas 10 u. a 20.000 dan un promedio de 15.000."""
    proveedor = cliente.post(
        "/api/terceros", json={"nombre": "Proveedor", "tipo": "proveedor"}
    ).json()
    cliente.post(
        "/api/compras",
        json={
            "proveedor_id": proveedor["id"],
            "forma_pago": "contado",
            "lineas": [
                {
                    "producto_id": producto["id"],
                    "cantidad": 10,
                    "costo_unit": 20000,
                    "iva_pct": 0,
                }
            ],
        },
    )
    actualizado = cliente.get("/api/productos").json()[0]
    assert actualizado["stock"] == 20
    assert actualizado["costo_promedio"] == 15000

    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 4,
                    "precio_unit": 30000,
                    "iva_pct": 0,
                }
            ]
        },
    )
    assert saldo(cliente, "6135") == 60000  # 4 x 15.000
    assert saldo(cliente, "1435") == 240000  # 16 x 15.000


def test_kardex_registra_cada_movimiento(cliente: TestClient, producto):
    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 2,
                    "precio_unit": 20000,
                }
            ]
        },
    )
    kardex = cliente.get(f"/api/inventario/kardex/{producto['id']}").json()
    assert [k["tipo"] for k in kardex] == ["ENTRADA", "SALIDA"]
    assert kardex[-1]["saldo_cant"] == 8
    assert kardex[-1]["saldo_costo"] == 80000


def test_ajuste_negativo_es_perdida(cliente: TestClient, producto):
    respuesta = cliente.post(
        "/api/inventario/ajuste",
        json={"producto_id": producto["id"], "modo": "delta", "cantidad": -2, "nota": "Averia"},
    )
    assert respuesta.status_code == 200
    assert cliente.get("/api/productos").json()[0]["stock"] == 8
    assert saldo(cliente, "6150") == 20000  # perdida de inventario
    assert saldo(cliente, "1435") == 80000


def test_ajuste_por_conteo_fisico(cliente: TestClient, producto):
    cliente.post(
        "/api/inventario/ajuste",
        json={"producto_id": producto["id"], "modo": "conteo", "cantidad": 12},
    )
    assert cliente.get("/api/productos").json()[0]["stock"] == 12
    assert saldo(cliente, "4210") == 20000  # sobrante como otro ingreso


# ----------------------------------------------------------- compras y pagos
def test_compra_a_credito_y_pago_parcial(cliente: TestClient, producto):
    proveedor = cliente.post(
        "/api/terceros", json={"nombre": "Proveedor", "tipo": "proveedor"}
    ).json()
    compra = cliente.post(
        "/api/compras",
        json={
            "proveedor_id": proveedor["id"],
            "forma_pago": "credito",
            "lineas": [
                {"producto_id": producto["id"], "cantidad": 5, "costo_unit": 10000, "iva_pct": 19}
            ],
        },
    ).json()

    assert cliente.get(f"/api/compras/{compra['id']}").json()["saldo"] == 59500
    assert saldo(cliente, "2205") == 59500
    assert saldo(cliente, "1665") == 9500  # IVA descontable

    cliente.post(
        "/api/pagos",
        json={"clase": "pago", "doc_id": compra["id"], "monto": 30000, "metodo": "banco"},
    )
    assert cliente.get(f"/api/compras/{compra['id']}").json()["saldo"] == 29500
    assert saldo(cliente, "1110") == -30000


def test_abono_mayor_al_saldo_es_rechazado(cliente: TestClient, producto, cliente_taller):
    venta = cliente.post(
        "/api/ventas",
        json={
            "forma_pago": "credito",
            "cliente_id": cliente_taller["id"],
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 1,
                    "precio_unit": 20000,
                    "iva_pct": 0,
                }
            ],
        },
    ).json()
    respuesta = cliente.post(
        "/api/pagos", json={"clase": "cobro", "doc_id": venta["id"], "monto": 999999}
    )
    assert respuesta.status_code == 400
    assert "supera el saldo" in respuesta.json()["detail"]


def test_gasto_debita_la_cuenta_elegida(cliente: TestClient):
    cuentas = {c["codigo"]: c["id"] for c in cliente.get("/api/cuentas").json()}
    respuesta = cliente.post(
        "/api/gastos",
        json={
            "cuenta_id": cuentas["5120"],
            "monto": 500000,
            "descripcion": "Arriendo",
            "metodo": "efectivo",
        },
    )
    assert respuesta.status_code == 201
    assert saldo(cliente, "5120") == 500000
    assert saldo(cliente, "1105") == -500000


def test_gasto_exige_cuenta_de_gasto(cliente: TestClient):
    cuentas = {c["codigo"]: c["id"] for c in cliente.get("/api/cuentas").json()}
    respuesta = cliente.post("/api/gastos", json={"cuenta_id": cuentas["1105"], "monto": 1000})
    assert respuesta.status_code == 400


def test_traslado_mueve_dinero_entre_caja_y_banco(cliente: TestClient):
    cliente.post("/api/traslados", json={"monto": 100000, "origen": "efectivo", "destino": "banco"})
    assert saldo(cliente, "1105") == -100000
    assert saldo(cliente, "1110") == 100000


def test_traslado_al_mismo_destino_es_rechazado(cliente: TestClient):
    respuesta = cliente.post(
        "/api/traslados", json={"monto": 1000, "origen": "banco", "destino": "banco"}
    )
    assert respuesta.status_code == 400


# ------------------------------------------------------------------ ecuacion
def test_la_ecuacion_contable_siempre_cuadra(cliente: TestClient, producto, cliente_taller, db):
    """Recorrido completo de operaciones: el balance debe seguir en cero."""
    cuentas = {c["codigo"]: c["id"] for c in cliente.get("/api/cuentas").json()}
    proveedor = cliente.post(
        "/api/terceros", json={"nombre": "Proveedor", "tipo": "proveedor"}
    ).json()

    cliente.post(
        "/api/compras",
        json={
            "proveedor_id": proveedor["id"],
            "forma_pago": "credito",
            "lineas": [
                {"producto_id": producto["id"], "cantidad": 20, "costo_unit": 12000, "iva_pct": 19}
            ],
        },
    )
    venta = cliente.post(
        "/api/ventas",
        json={
            "forma_pago": "credito",
            "cliente_id": cliente_taller["id"],
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 5,
                    "precio_unit": 25000,
                    "iva_pct": 19,
                }
            ],
        },
    ).json()
    cliente.post("/api/pagos", json={"clase": "cobro", "doc_id": venta["id"], "monto": 50000})
    cliente.post("/api/gastos", json={"cuenta_id": cuentas["5135"], "monto": 90000})
    cliente.post(
        "/api/inventario/ajuste",
        json={"producto_id": producto["id"], "modo": "delta", "cantidad": -1},
    )
    cliente.post("/api/traslados", json={"monto": 20000, "origen": "efectivo", "destino": "banco"})
    cliente.post(
        "/api/asientos",
        json={
            "descripcion": "Depreciacion",
            "lineas": [
                {"cuenta_id": cuentas["5195"], "debe": 40000},
                {"cuenta_id": cuentas["1592"], "haber": 40000},
            ],
        },
    )

    balance = cliente.get("/api/informes/balance").json()
    assert balance["diferencia"] == 0
    assert cliente.get("/api/estado").json()["cuadre"] == 0

    # Cada asiento, por separado, tambien cuadra.
    for asiento in cliente.get("/api/informes/libro-diario?desde=2000-01-01").json():
        debe = sum(x["debe"] for x in asiento["lineas"])
        haber = sum(x["haber"] for x in asiento["lineas"])
        assert round(debe - haber, 2) == 0, asiento["descripcion"]


def test_saldos_ignoran_asientos_anulados(cliente: TestClient, producto, db):
    venta = cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 1,
                    "precio_unit": 20000,
                }
            ]
        },
    ).json()
    cliente.post(f"/api/ventas/{venta['id']}/anular")
    codigos = [s["codigo"] for s in saldos_por_cuenta(db)]
    assert "4135" in codigos  # la cuenta aparece
    assert saldo(cliente, "4135") == 0  # pero sin efecto neto
