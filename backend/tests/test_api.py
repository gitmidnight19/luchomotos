"""Pruebas de la API: catalogos, ordenes de trabajo, informes y datos de ejemplo."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_salud_y_estado(cliente: TestClient):
    assert cliente.get("/salud").json()["ok"] is True
    estado = cliente.get("/api/estado").json()
    assert estado["ventas"] == 0
    assert estado["cuadre"] == 0
    assert estado["servidor"].startswith("http://")


def test_portada_muestra_la_direccion_del_servidor(cliente: TestClient):
    pagina = cliente.get("/")
    assert pagina.status_code == 200
    assert "app movil" in pagina.text


def test_plan_de_cuentas_sembrado(cliente: TestClient):
    cuentas = cliente.get("/api/cuentas").json()
    codigos = {c["codigo"] for c in cuentas}
    assert {"1105", "1435", "2408", "4135", "6135", "5120"} <= codigos


def test_config_se_lee_y_actualiza(cliente: TestClient):
    config = cliente.get("/api/config").json()
    assert config["iva_pct"] == "19"

    actualizada = cliente.put("/api/config", json={"empresa": "Moto Taller JP", "iva_pct": "0"})
    assert actualizada.json()["empresa"] == "Moto Taller JP"
    assert cliente.get("/api/config").json()["iva_pct"] == "0"


def test_iva_por_defecto_sale_de_la_configuracion(cliente: TestClient, producto):
    cliente.put("/api/config", json={"iva_pct": "5"})
    venta = cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 1,
                    "precio_unit": 100000,
                }
            ]
        },
    ).json()
    assert cliente.get(f"/api/ventas/{venta['id']}").json()["iva"] == 5000


def test_crud_de_terceros(cliente: TestClient):
    creado = cliente.post(
        "/api/terceros", json={"nombre": "Ana Torres", "tipo": "cliente", "telefono": "300"}
    ).json()
    assert creado["nombre"] == "Ana Torres"

    editado = cliente.put(
        f"/api/terceros/{creado['id']}",
        json={"nombre": "Ana Maria Torres", "tipo": "ambos", "activo": True},
    ).json()
    assert editado["nombre"] == "Ana Maria Torres"

    cliente.delete(f"/api/terceros/{creado['id']}")
    assert cliente.get("/api/terceros").json() == []
    assert len(cliente.get("/api/terceros?solo_activos=false").json()) == 1


def test_sku_duplicado_es_rechazado(cliente: TestClient, producto):
    respuesta = cliente.post("/api/productos", json={"nombre": "Otro", "sku": producto["sku"]})
    assert respuesta.status_code == 400


def test_producto_inexistente_da_404(cliente: TestClient):
    respuesta = cliente.post(
        "/api/inventario/ajuste", json={"producto_id": 9999, "cantidad": 1, "modo": "delta"}
    )
    assert respuesta.status_code == 404


def test_motos_y_su_historial(cliente: TestClient, cliente_taller):
    moto = cliente.post(
        "/api/motos",
        json={"placa": "abc12d", "cliente_id": cliente_taller["id"], "marca": "Bajaj"},
    ).json()
    assert moto["placa"] == "ABC12D"
    assert moto["cliente_nombre"] == cliente_taller["nombre"]

    historial = cliente.get(f"/api/motos/{moto['id']}/historial").json()
    assert historial == {"ordenes": [], "ventas": []}


def test_orden_de_trabajo_se_factura(cliente: TestClient, producto, cliente_taller):
    servicio = cliente.get("/api/servicios").json()[0]
    moto = cliente.post(
        "/api/motos", json={"placa": "XYZ99Z", "cliente_id": cliente_taller["id"]}
    ).json()

    orden = cliente.post(
        "/api/ordenes",
        json={
            "cliente_id": cliente_taller["id"],
            "moto_id": moto["id"],
            "km": 15000,
            "estado": "en_proceso",
            "mecanico": "Andres",
            "diagnostico": "Frenos gastados",
            "items": [
                {
                    "tipo": "servicio",
                    "servicio_id": servicio["id"],
                    "descripcion": servicio["nombre"],
                    "cantidad": 1,
                    "precio_unit": 30000,
                    "iva_pct": 0,
                },
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 2,
                    "precio_unit": 20000,
                    "iva_pct": 0,
                },
            ],
        },
    ).json()
    assert orden["numero"].startswith("OT-")

    detalle = cliente.get(f"/api/ordenes/{orden['id']}").json()
    assert detalle["total"] == 70000
    assert detalle["items"][1]["stock"] == 10

    factura = cliente.post(
        f"/api/ordenes/{orden['id']}/facturar", json={"forma_pago": "contado"}
    ).json()
    venta = cliente.get(f"/api/ventas/{factura['id']}").json()
    assert venta["total"] == 70000
    assert venta["costo_total"] == 20000
    assert cliente.get(f"/api/ordenes/{orden['id']}").json()["estado"] == "facturada"
    assert cliente.get("/api/productos").json()[0]["stock"] == 8


def test_orden_facturada_no_se_modifica(cliente: TestClient, cliente_taller):
    servicio = cliente.get("/api/servicios").json()[0]
    orden = cliente.post(
        "/api/ordenes",
        json={
            "cliente_id": cliente_taller["id"],
            "items": [
                {
                    "tipo": "servicio",
                    "servicio_id": servicio["id"],
                    "cantidad": 1,
                    "precio_unit": 10000,
                }
            ],
        },
    ).json()
    cliente.post(f"/api/ordenes/{orden['id']}/facturar", json={})

    respuesta = cliente.put(f"/api/ordenes/{orden['id']}", json={"items": []})
    assert respuesta.status_code == 400


def test_anular_factura_reabre_la_orden(cliente: TestClient, cliente_taller):
    servicio = cliente.get("/api/servicios").json()[0]
    orden = cliente.post(
        "/api/ordenes",
        json={
            "cliente_id": cliente_taller["id"],
            "items": [
                {
                    "tipo": "servicio",
                    "servicio_id": servicio["id"],
                    "cantidad": 1,
                    "precio_unit": 10000,
                }
            ],
        },
    ).json()
    factura = cliente.post(f"/api/ordenes/{orden['id']}/facturar", json={}).json()
    cliente.post(f"/api/ventas/{factura['id']}/anular")
    assert cliente.get(f"/api/ordenes/{orden['id']}").json()["estado"] == "terminada"


def test_busqueda_rapida(cliente: TestClient, producto, cliente_taller):
    resultado = cliente.get("/api/buscar?q=bujia").json()
    assert len(resultado["productos"]) == 1
    assert (
        cliente.get("/api/buscar?q=prueba").json()["clientes"][0]["nombre"]
        == (cliente_taller["nombre"])
    )


def test_validacion_de_entrada(cliente: TestClient):
    assert cliente.post("/api/ventas", json={"lineas": []}).status_code == 422
    assert cliente.post("/api/gastos", json={"cuenta_id": 1, "monto": -5}).status_code == 422
    assert cliente.post("/api/terceros", json={"nombre": ""}).status_code == 422


# ----------------------------------------------------------------- informes
def test_dashboard_refleja_las_ventas(cliente: TestClient, producto):
    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 2,
                    "precio_unit": 20000,
                    "iva_pct": 0,
                }
            ]
        },
    )
    panel = cliente.get("/api/informes/dashboard").json()
    assert panel["ventas_hoy"] == 40000
    assert panel["num_ventas_mes"] == 1
    assert panel["ticket_promedio"] == 40000
    assert panel["utilidad_bruta_mes"] == 20000
    assert panel["inventario_valor"] == 80000
    assert len(panel["serie"]) == 30
    assert panel["top_productos"][0]["monto"] == 40000


def test_alerta_de_stock_minimo(cliente: TestClient, producto):
    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 9,
                    "precio_unit": 20000,
                }
            ]
        },
    )
    panel = cliente.get("/api/informes/dashboard").json()
    assert panel["num_bajo_stock"] == 1
    assert panel["bajo_stock"][0]["stock"] == 1
    assert len(cliente.get("/api/productos?bajo_minimo=true").json()) == 1


def test_estado_de_resultados(cliente: TestClient, producto):
    cuentas = {c["codigo"]: c["id"] for c in cliente.get("/api/cuentas").json()}
    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 5,
                    "precio_unit": 20000,
                    "iva_pct": 0,
                }
            ]
        },
    )
    cliente.post("/api/gastos", json={"cuenta_id": cuentas["5120"], "monto": 30000})

    er = cliente.get("/api/informes/estado-resultados?desde=2000-01-01").json()
    assert er["total_ingresos"] == 100000
    assert er["total_costos"] == 50000
    assert er["utilidad_bruta"] == 50000
    assert er["total_gastos"] == 30000
    assert er["utilidad_neta"] == 20000
    assert er["margen_neto"] == 20.0


def test_flujo_de_caja_e_impuestos(cliente: TestClient, producto):
    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 1,
                    "precio_unit": 100000,
                    "iva_pct": 19,
                }
            ]
        },
    )
    flujo = cliente.get("/api/informes/flujo?desde=2000-01-01").json()
    assert flujo["total_entradas"] == 119000
    assert flujo["saldo_final"] == 119000

    impuestos = cliente.get("/api/informes/impuestos?desde=2000-01-01").json()
    assert impuestos["iva_generado"] == 19000
    assert impuestos["saldo_a_pagar"] == 19000


def test_inventario_valorizado(cliente: TestClient, producto):
    inventario = cliente.get("/api/informes/inventario").json()
    assert inventario["total_costo"] == 100000
    assert inventario["total_venta"] == 200000
    assert inventario["items"][0]["margen"] == 50.0


def test_ventas_por_periodo(cliente: TestClient, producto):
    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 1,
                    "precio_unit": 20000,
                    "iva_pct": 0,
                }
            ]
        },
    )
    filas = cliente.get("/api/informes/ventas?desde=2000-01-01&agrupar=mes").json()
    assert filas[-1]["num"] == 1
    assert filas[-1]["utilidad"] == 10000
    assert filas[-1]["margen"] == 50.0


def test_libro_mayor(cliente: TestClient, producto):
    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 1,
                    "precio_unit": 20000,
                    "iva_pct": 0,
                }
            ]
        },
    )
    caja = next(c for c in cliente.get("/api/cuentas").json() if c["codigo"] == "1105")
    mayor = cliente.get(f"/api/informes/libro-mayor/{caja['id']}?desde=2000-01-01").json()
    assert mayor["saldo_inicial"] == 0
    assert mayor["saldo_final"] == 20000
    assert len(mayor["movimientos"]) == 1


# --------------------------------------------------------------------- demo
def test_datos_de_ejemplo(cliente: TestClient):
    assert cliente.post("/api/demo").status_code == 200

    estado = cliente.get("/api/estado").json()
    assert estado["ventas"] > 100
    assert estado["productos"] == 26
    assert estado["cuadre"] == 0

    panel = cliente.get("/api/informes/dashboard").json()
    assert panel["ventas_mes"] > 0
    assert panel["inventario_valor"] > 0

    # No se puede cargar dos veces sobre datos existentes.
    assert cliente.post("/api/demo").status_code == 400


def test_limpiar_deja_el_plan_de_cuentas(cliente: TestClient, producto):
    cliente.post(
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
    )
    assert cliente.delete("/api/demo").status_code == 200
    estado = cliente.get("/api/estado").json()
    assert estado["ventas"] == 0
    assert estado["productos"] == 0
    assert len(cliente.get("/api/cuentas").json()) > 30
    assert len(cliente.get("/api/servicios").json()) == 10
