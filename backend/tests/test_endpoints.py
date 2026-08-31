"""Cobertura de los listados y del resto de operaciones expuestas a la app."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _venta(cliente: TestClient, producto: dict, **extra) -> dict:
    cuerpo = {
        "lineas": [
            {
                "tipo": "producto",
                "producto_id": producto["id"],
                "cantidad": 1,
                "precio_unit": 20000,
                "iva_pct": 0,
            }
        ],
        **extra,
    }
    return cliente.post("/api/ventas", json=cuerpo).json()


def test_listado_de_ventas_y_filtro_de_pendientes(cliente, producto, cliente_taller):
    _venta(cliente, producto)
    _venta(cliente, producto, forma_pago="credito", cliente_id=cliente_taller["id"])

    todas = cliente.get("/api/ventas?desde=2000-01-01").json()
    assert len(todas) == 2
    assert todas[0]["cliente_nombre"] in (None, cliente_taller["nombre"])

    pendientes = cliente.get("/api/ventas?desde=2000-01-01&solo_pendientes=true").json()
    assert len(pendientes) == 1
    assert pendientes[0]["saldo"] == 20000


def test_listado_de_compras_y_detalle(cliente, producto):
    proveedor = cliente.post(
        "/api/terceros", json={"nombre": "Repuestos SAS", "tipo": "proveedor"}
    ).json()
    compra = cliente.post(
        "/api/compras",
        json={
            "proveedor_id": proveedor["id"],
            "forma_pago": "credito",
            "lineas": [
                {
                    "producto_id": producto["id"],
                    "cantidad": 3,
                    "costo_unit": 9000,
                    "iva_pct": 0,
                    "precio_venta": 25000,
                }
            ],
        },
    ).json()

    listado = cliente.get("/api/compras?desde=2000-01-01").json()
    assert listado[0]["proveedor_nombre"] == "Repuestos SAS"
    assert cliente.get("/api/compras?desde=2000-01-01&solo_pendientes=true").json()

    detalle = cliente.get(f"/api/compras/{compra['id']}").json()
    assert detalle["lineas"][0]["producto_nombre"] == producto["nombre"]
    assert detalle["lineas"][0]["sku"] == producto["sku"]
    # El precio de venta se actualizo desde la compra.
    assert cliente.get("/api/productos").json()[0]["precio_venta"] == 25000


def test_anular_compra_retira_el_inventario(cliente, producto):
    compra = cliente.post(
        "/api/compras",
        json={
            "forma_pago": "contado",
            "lineas": [
                {"producto_id": producto["id"], "cantidad": 5, "costo_unit": 10000, "iva_pct": 0}
            ],
        },
    ).json()
    assert cliente.get("/api/productos").json()[0]["stock"] == 15

    assert cliente.post(f"/api/compras/{compra['id']}/anular").status_code == 200
    assert cliente.get("/api/productos").json()[0]["stock"] == 10
    assert cliente.get(f"/api/compras/{compra['id']}").json()["estado"] == "anulada"
    assert cliente.get("/api/informes/balance").json()["diferencia"] == 0


def test_no_se_anula_una_compra_ya_vendida(cliente, producto):
    compra = cliente.post(
        "/api/compras",
        json={
            "forma_pago": "contado",
            "lineas": [
                {"producto_id": producto["id"], "cantidad": 2, "costo_unit": 10000, "iva_pct": 0}
            ],
        },
    ).json()
    cliente.post(
        "/api/ventas",
        json={
            "lineas": [
                {
                    "tipo": "producto",
                    "producto_id": producto["id"],
                    "cantidad": 11,
                    "precio_unit": 20000,
                }
            ]
        },
    )
    respuesta = cliente.post(f"/api/compras/{compra['id']}/anular")
    assert respuesta.status_code == 400
    assert "ya se vendieron" in respuesta.json()["detail"]


def test_gastos_listado_y_anulacion(cliente):
    cuentas = {c["codigo"]: c["id"] for c in cliente.get("/api/cuentas").json()}
    gasto = cliente.post(
        "/api/gastos",
        json={"cuenta_id": cuentas["5145"], "monto": 60000, "descripcion": "Gasolina"},
    ).json()

    listado = cliente.get("/api/gastos?desde=2000-01-01").json()
    assert listado[0]["cuenta_codigo"] == "5145"
    assert listado[0]["cuenta_nombre"].startswith("Transporte")

    assert cliente.post(f"/api/gastos/{gasto['id']}/anular").status_code == 200
    assert cliente.get("/api/gastos?desde=2000-01-01").json()[0]["estado"] == "anulado"
    assert cliente.post(f"/api/gastos/{gasto['id']}/anular").status_code == 400
    assert cliente.get("/api/informes/balance").json()["diferencia"] == 0


def test_gasto_a_credito_queda_por_pagar(cliente):
    cuentas = {c["codigo"]: c["id"] for c in cliente.get("/api/cuentas").json()}
    cliente.post(
        "/api/gastos",
        json={"cuenta_id": cuentas["5110"], "monto": 200000, "metodo": "credito"},
    )
    saldos = {s["codigo"]: s["saldo"] for s in cliente.get("/api/informes/saldos").json()}
    assert saldos["2335"] == 200000
    assert saldos.get("1105", 0) == 0


def test_pagos_listado(cliente, producto, cliente_taller):
    venta = _venta(cliente, producto, forma_pago="credito", cliente_id=cliente_taller["id"])
    cliente.post("/api/pagos", json={"clase": "cobro", "doc_id": venta["id"], "monto": 5000})

    pagos = cliente.get("/api/pagos?desde=2000-01-01").json()
    assert pagos[0]["tercero_nombre"] == cliente_taller["nombre"]
    assert pagos[0]["clase"] == "cobro"

    detalle = cliente.get(f"/api/ventas/{venta['id']}").json()
    assert len(detalle["pagos"]) == 1
    assert detalle["saldo"] == 15000


def test_ordenes_listado_edicion_y_anulacion(cliente, cliente_taller):
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
                    "iva_pct": 0,
                }
            ],
        },
    ).json()

    abiertas = cliente.get("/api/ordenes?estado=abiertas").json()
    assert len(abiertas) == 1
    assert abiertas[0]["cliente_nombre"] == cliente_taller["nombre"]
    assert abiertas[0]["total"] == 10000

    cliente.put(
        f"/api/ordenes/{orden['id']}",
        json={
            "cliente_id": cliente_taller["id"],
            "estado": "terminada",
            "items": [
                {
                    "tipo": "servicio",
                    "servicio_id": servicio["id"],
                    "cantidad": 2,
                    "precio_unit": 10000,
                    "iva_pct": 0,
                }
            ],
        },
    )
    editada = cliente.get(f"/api/ordenes/{orden['id']}").json()
    assert editada["estado"] == "terminada"
    assert editada["total"] == 20000
    assert len(editada["items"]) == 1

    assert cliente.delete(f"/api/ordenes/{orden['id']}").status_code == 200
    assert cliente.get(f"/api/ordenes/{orden['id']}").json()["estado"] == "anulada"


def test_orden_sin_items_no_se_factura(cliente, cliente_taller):
    orden = cliente.post("/api/ordenes", json={"cliente_id": cliente_taller["id"]}).json()
    respuesta = cliente.post(f"/api/ordenes/{orden['id']}/facturar", json={})
    assert respuesta.status_code == 400


def test_crud_de_servicios_y_categorias(cliente):
    servicio = cliente.post(
        "/api/servicios", json={"nombre": "Lavado premium", "codigo": "S099", "precio": 18000}
    ).json()
    assert servicio["precio"] == 18000

    editado = cliente.put(
        f"/api/servicios/{servicio['id']}",
        json={"nombre": "Lavado premium", "codigo": "S099", "precio": 22000},
    ).json()
    assert editado["precio"] == 22000

    cliente.delete(f"/api/servicios/{servicio['id']}")
    assert all(s["id"] != servicio["id"] for s in cliente.get("/api/servicios").json())

    categoria = cliente.post("/api/categorias", json={"nombre": "Suspension"}).json()
    repetida = cliente.post("/api/categorias", json={"nombre": "Suspension"}).json()
    assert categoria["id"] == repetida["id"]


def test_productos_editar_y_desactivar(cliente, producto):
    categoria = cliente.get("/api/categorias").json()[0]
    editado = cliente.put(
        f"/api/productos/{producto['id']}",
        json={
            "nombre": "Bujia iridium",
            "sku": producto["sku"],
            "categoria_id": categoria["id"],
            "precio_venta": 30000,
            "stock_min": 5,
        },
    ).json()
    assert editado["nombre"] == "Bujia iridium"
    assert editado["categoria_nombre"] == categoria["nombre"]
    assert editado["stock"] == 10  # editar no toca existencias

    cliente.delete(f"/api/productos/{producto['id']}")
    assert cliente.get("/api/productos").json() == []
    assert len(cliente.get("/api/productos?solo_activos=false").json()) == 1


def test_motos_editar_y_borrar(cliente, cliente_taller):
    moto = cliente.post("/api/motos", json={"placa": "aaa11a", "marca": "AKT"}).json()
    editada = cliente.put(
        f"/api/motos/{moto['id']}",
        json={"placa": "bbb22b", "marca": "AKT", "cliente_id": cliente_taller["id"]},
    ).json()
    assert editada["placa"] == "BBB22B"
    assert editada["cliente_nombre"] == cliente_taller["nombre"]

    assert len(cliente.get(f"/api/motos?cliente_id={cliente_taller['id']}").json()) == 1
    assert cliente.delete(f"/api/motos/{moto['id']}").status_code == 200
    assert cliente.get("/api/motos").json() == []


def test_recursos_inexistentes_dan_404(cliente):
    assert cliente.get("/api/ventas/999").status_code == 404
    assert cliente.get("/api/compras/999").status_code == 404
    assert cliente.get("/api/ordenes/999").status_code == 404
    assert cliente.put("/api/motos/999", json={"placa": "X"}).status_code == 404
    assert cliente.delete("/api/terceros/999").status_code == 404
    assert cliente.put("/api/servicios/999", json={"nombre": "X"}).status_code == 404


def test_crear_cuenta_contable(cliente):
    creada = cliente.post(
        "/api/cuentas",
        json={"codigo": "5170", "nombre": "Capacitacion", "tipo": "GASTO", "naturaleza": "D"},
    )
    assert creada.status_code == 201
    repetida = cliente.post(
        "/api/cuentas",
        json={"codigo": "5170", "nombre": "Otra", "tipo": "GASTO", "naturaleza": "D"},
    )
    assert repetida.status_code == 400


def test_balance_de_prueba_y_libro_diario(cliente, producto):
    _venta(cliente, producto)
    prueba = cliente.get("/api/informes/balance-prueba?desde=2000-01-01").json()
    assert prueba["total_debe"] == prueba["total_haber"]

    diario = cliente.get("/api/informes/libro-diario?desde=2000-01-01").json()
    assert any(a["doc_tipo"] == "VENTA" for a in diario)
    assert all(a["total"] > 0 for a in diario)


def test_respaldo_descarga_la_base(cliente):
    respuesta = cliente.get("/api/respaldo")
    assert respuesta.status_code == 200
    assert respuesta.content[:15] == b"SQLite format 3"


def test_asiento_manual_requiere_dos_lineas(cliente):
    cuentas = {c["codigo"]: c["id"] for c in cliente.get("/api/cuentas").json()}
    respuesta = cliente.post(
        "/api/asientos", json={"lineas": [{"cuenta_id": cuentas["1105"], "debe": 100}]}
    )
    assert respuesta.status_code == 422

    descuadrado = cliente.post(
        "/api/asientos",
        json={
            "lineas": [
                {"cuenta_id": cuentas["1105"], "debe": 100},
                {"cuenta_id": cuentas["3105"], "haber": 90},
            ]
        },
    )
    assert descuadrado.status_code == 400
