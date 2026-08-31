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
                {"cuenta_id": cuentas["5195"], "debe": 8000000, "detalle": "gasto"},
                {"cuenta_id": cuentas["1592"], "haber": 8000000, "detalle": "acumulada"},
            ],
        },
    )
    assert respuesta.status_code == 201, respuesta.text

    balance = balance_general(db, __import__("datetime").date.today())
    depreciacion = next(a for a in balance["activos"] if a["codigo"] == "1592")
    assert depreciacion["saldo"] == -8000000
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
                    "precio_unit": 2000000,
                    "iva_pct": 19,
                }
            ],
        },
    )
    assert respuesta.status_code == 201, respuesta.text
    venta = cliente.get(f"/api/ventas/{respuesta.json()['id']}").json()

    assert venta["subtotal"] == 4000000
    assert venta["iva"] == 760000
    assert venta["total"] == 4760000
    assert venta["costo_total"] == 2000000  # 2 unidades al costo promedio de 10.000

    inventario = cliente.get("/api/productos").json()[0]
    assert inventario["stock"] == 8

    assert saldo(cliente, "1105") == 4760000  # caja
    assert saldo(cliente, "4135") == 4000000  # ingresos por repuestos
    assert saldo(cliente, "2408") == 760000  # IVA generado
    assert saldo(cliente, "6135") == 2000000  # costo de ventas
    assert saldo(cliente, "1435") == 8000000  # inventario restante


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
                    "precio_unit": 5000000,
                    "iva_pct": 0,
                }
            ]
        },
    )
    assert saldo(cliente, "4140") == 5000000
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
                    "precio_unit": 2000000,
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
                    "precio_unit": 2000000,
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
                    "precio_unit": 2000000,
                    "iva_pct": 0,
                }
            ],
        },
    )
    cartera = cliente.get("/api/informes/cartera").json()
    assert cartera["total_cobrar"] == 2000000
    assert saldo(cliente, "1305") == 2000000
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
                    "precio_unit": 2000000,
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
    assert saldo(cliente, "1435") == 10000000


def test_no_se_puede_anular_dos_veces(cliente: TestClient, producto):
    venta = cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 1,
                    "precio_unit": 2000000,
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
                    "costo_unit": 2000000,
                    "iva_pct": 0,
                }
            ],
        },
    )
    actualizado = cliente.get("/api/productos").json()[0]
    assert actualizado["stock"] == 20
    assert actualizado["costo_promedio"] == 1500000

    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 4,
                    "precio_unit": 3000000,
                    "iva_pct": 0,
                }
            ]
        },
    )
    assert saldo(cliente, "6135") == 6000000  # 4 x 15.000
    assert saldo(cliente, "1435") == 24000000  # 16 x 15.000


def test_kardex_registra_cada_movimiento(cliente: TestClient, producto):
    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 2,
                    "precio_unit": 2000000,
                }
            ]
        },
    )
    kardex = cliente.get(f"/api/inventario/kardex/{producto['id']}").json()
    assert [k["tipo"] for k in kardex] == ["ENTRADA", "SALIDA"]
    assert kardex[-1]["saldo_cant"] == 8
    assert kardex[-1]["saldo_costo"] == 8000000


def test_ajuste_negativo_es_perdida(cliente: TestClient, producto):
    respuesta = cliente.post(
        "/api/inventario/ajuste",
        json={"producto_id": producto["id"], "modo": "delta", "cantidad": -2, "nota": "Averia"},
    )
    assert respuesta.status_code == 200
    assert cliente.get("/api/productos").json()[0]["stock"] == 8
    assert saldo(cliente, "6150") == 2000000  # perdida de inventario
    assert saldo(cliente, "1435") == 8000000


def test_ajuste_por_conteo_fisico(cliente: TestClient, producto):
    cliente.post(
        "/api/inventario/ajuste",
        json={"producto_id": producto["id"], "modo": "conteo", "cantidad": 12},
    )
    assert cliente.get("/api/productos").json()[0]["stock"] == 12
    assert saldo(cliente, "4210") == 2000000  # sobrante como otro ingreso


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
                {"producto_id": producto["id"], "cantidad": 5, "costo_unit": 1000000, "iva_pct": 19}
            ],
        },
    ).json()

    assert cliente.get(f"/api/compras/{compra['id']}").json()["saldo"] == 5950000
    assert saldo(cliente, "2205") == 5950000
    assert saldo(cliente, "1665") == 950000  # IVA descontable

    cliente.post(
        "/api/pagos",
        json={"clase": "pago", "doc_id": compra["id"], "monto": 3000000, "metodo": "banco"},
    )
    assert cliente.get(f"/api/compras/{compra['id']}").json()["saldo"] == 2950000
    assert saldo(cliente, "1110") == -3000000


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
                    "precio_unit": 2000000,
                    "iva_pct": 0,
                }
            ],
        },
    ).json()
    respuesta = cliente.post(
        "/api/pagos", json={"clase": "cobro", "doc_id": venta["id"], "monto": 99999900}
    )
    assert respuesta.status_code == 400
    assert "supera el saldo" in respuesta.json()["detail"]


def test_gasto_debita_la_cuenta_elegida(cliente: TestClient):
    cuentas = {c["codigo"]: c["id"] for c in cliente.get("/api/cuentas").json()}
    respuesta = cliente.post(
        "/api/gastos",
        json={
            "cuenta_id": cuentas["5120"],
            "monto": 50000000,
            "descripcion": "Arriendo",
            "metodo": "efectivo",
        },
    )
    assert respuesta.status_code == 201
    assert saldo(cliente, "5120") == 50000000
    assert saldo(cliente, "1105") == -50000000


def test_gasto_exige_cuenta_de_gasto(cliente: TestClient):
    cuentas = {c["codigo"]: c["id"] for c in cliente.get("/api/cuentas").json()}
    respuesta = cliente.post("/api/gastos", json={"cuenta_id": cuentas["1105"], "monto": 100000})
    assert respuesta.status_code == 400


def test_traslado_mueve_dinero_entre_caja_y_banco(cliente: TestClient):
    cliente.post(
        "/api/traslados", json={"monto": 10000000, "origen": "efectivo", "destino": "banco"}
    )
    assert saldo(cliente, "1105") == -10000000
    assert saldo(cliente, "1110") == 10000000


def test_traslado_al_mismo_destino_es_rechazado(cliente: TestClient):
    respuesta = cliente.post(
        "/api/traslados", json={"monto": 100000, "origen": "banco", "destino": "banco"}
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
                {
                    "producto_id": producto["id"],
                    "cantidad": 20,
                    "costo_unit": 1200000,
                    "iva_pct": 19,
                }
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
                    "precio_unit": 2500000,
                    "iva_pct": 19,
                }
            ],
        },
    ).json()
    cliente.post("/api/pagos", json={"clase": "cobro", "doc_id": venta["id"], "monto": 5000000})
    cliente.post("/api/gastos", json={"cuenta_id": cuentas["5135"], "monto": 9000000})
    cliente.post(
        "/api/inventario/ajuste",
        json={"producto_id": producto["id"], "modo": "delta", "cantidad": -1},
    )
    cliente.post(
        "/api/traslados", json={"monto": 2000000, "origen": "efectivo", "destino": "banco"}
    )
    cliente.post(
        "/api/asientos",
        json={
            "descripcion": "Depreciacion",
            "lineas": [
                {"cuenta_id": cuentas["5195"], "debe": 4000000},
                {"cuenta_id": cuentas["1592"], "haber": 4000000},
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
                    "precio_unit": 2000000,
                }
            ]
        },
    ).json()
    cliente.post(f"/api/ventas/{venta['id']}/anular")
    codigos = [s["codigo"] for s in saldos_por_cuenta(db)]
    assert "4135" in codigos  # la cuenta aparece
    assert saldo(cliente, "4135") == 0  # pero sin efecto neto


# ------------------------------------------------- regresiones de informes
def test_el_estado_de_resultados_respeta_el_periodo(cliente: TestClient, producto):
    """Un informe de un periodo no puede devolver los importes de todos los tiempos.

    Las condiciones de fecha vivian en el ON de un LEFT JOIN, asi que no
    filtraban: el estado de resultados de un solo dia devolvia lo mismo que el
    de treinta anios.
    """
    cliente.post(
        "/api/ventas",
        json={
            "fecha": "2026-03-15",
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 1,
                    "precio_unit": 2000000,
                    "iva_pct": 0,
                }
            ],
        },
    )

    def ingresos(desde: str, hasta: str) -> int:
        url = f"/api/informes/estado-resultados?desde={desde}&hasta={hasta}"
        return cliente.get(url).json()["total_ingresos"]

    assert ingresos("2026-03-01", "2026-03-31") == 2000000
    assert ingresos("2026-04-01", "2026-04-30") == 0, "un mes sin ventas debe dar cero"
    assert ingresos("2026-03-15", "2026-03-15") == 2000000
    assert ingresos("2026-03-16", "2026-03-16") == 0


def test_anular_no_se_cuenta_dos_veces_en_los_libros(cliente: TestClient, producto):
    """El libro mayor y el flujo de caja deben coincidir con el balance.

    La anulacion publica un contra-asiento Y marcaba el original como anulado.
    Los informes que ademas filtraban por `anulado` restaban la operacion dos
    veces, y reportaban el doble de lo que decia el balance.
    """
    venta = cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 2,
                    "precio_unit": 2000000,
                    "iva_pct": 0,
                }
            ]
        },
    ).json()
    cliente.post(f"/api/ventas/{venta['id']}/anular")

    inventario = cliente.get("/api/informes/inventario").json()
    caja = next(c for c in cliente.get("/api/cuentas").json() if c["codigo"] == "1105")
    c1435 = next(c for c in cliente.get("/api/cuentas").json() if c["codigo"] == "1435")

    por_saldos = saldo(cliente, "1435")
    por_mayor = cliente.get(f"/api/informes/libro-mayor/{c1435['id']}?desde=2000-01-01").json()[
        "saldo_final"
    ]
    flujo = cliente.get("/api/informes/flujo?desde=2000-01-01").json()["saldo_final"]
    mayor_caja = cliente.get(f"/api/informes/libro-mayor/{caja['id']}?desde=2000-01-01").json()[
        "saldo_final"
    ]

    assert por_saldos == por_mayor == inventario["total_costo"], (
        "balance, libro mayor y auxiliar de inventario deben coincidir"
    )
    assert flujo == mayor_caja == saldo(cliente, "1105")
    assert cliente.get("/api/informes/balance").json()["diferencia"] == 0
