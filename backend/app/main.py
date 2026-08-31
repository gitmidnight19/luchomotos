"""Aplicacion FastAPI: API del sistema contable del taller.

La documentacion interactiva queda en /docs y el esquema OpenAPI en
/openapi.json, que es lo que consume el cliente tipado de la app movil.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from .config import ip_local, settings
from .database import Base, SessionLocal, engine
from .errores import NoEncontrado, ReglaNegocio
from .routers import catalogos, informes, operaciones, sistema
from .seed import sembrar

DESCRIPCION = """
API del sistema contable para taller de motos.

Cada documento que se registra (venta, compra, gasto, abono, ajuste) genera
automaticamente su asiento de **partida doble**, mueve el inventario al
**costo promedio ponderado** y alimenta los estados financieros.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        sembrar(db)
    yield


app = FastAPI(
    title=settings.nombre,
    version=settings.version,
    description=DESCRIPCION,
    lifespan=lifespan,
    openapi_tags=[
        {"name": "sistema", "description": "Configuracion, plan de cuentas y respaldo"},
        {"name": "terceros", "description": "Clientes y proveedores"},
        {"name": "motos", "description": "Motos e historial de servicio"},
        {"name": "inventario", "description": "Repuestos, kardex y ajustes"},
        {"name": "servicios", "description": "Lista de precios de mano de obra"},
        {"name": "ventas", "description": "Facturacion del mostrador"},
        {"name": "compras", "description": "Compras a proveedores"},
        {"name": "ordenes", "description": "Ordenes de trabajo del taller"},
        {"name": "gastos", "description": "Gastos operativos"},
        {"name": "tesoreria", "description": "Cobros, pagos y traslados"},
        {"name": "informes", "description": "Panel, estados financieros y libros"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sistema.router, prefix="/api")
app.include_router(catalogos.router, prefix="/api")
app.include_router(operaciones.router, prefix="/api")
app.include_router(informes.router, prefix="/api")


@app.exception_handler(NoEncontrado)
async def _no_encontrado(request: Request, exc: NoEncontrado) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": exc.mensaje})


@app.exception_handler(ReglaNegocio)
async def _regla_negocio(request: Request, exc: ReglaNegocio) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": exc.mensaje})


@app.get("/salud", tags=["sistema"], summary="Comprobacion de vida del servidor")
def salud() -> dict:
    return {"ok": True, "version": settings.version}


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def portada() -> str:
    """Pagina que muestra la direccion a la que debe conectarse la app movil."""
    url = f"http://{ip_local()}:{settings.puerto}"
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Servidor del taller</title>
<style>
 body{{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;color:#e2e8f0;
   display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}}
 .caja{{background:#1e293b;padding:32px 36px;border-radius:16px;max-width:520px;
   box-shadow:0 20px 60px rgba(0,0,0,.4)}}
 h1{{margin:0 0 6px;font-size:20px}} p{{color:#94a3b8;line-height:1.6}}
 code{{background:#0f172a;padding:10px 14px;border-radius:8px;display:block;
   font-size:18px;color:#38bdf8;margin:14px 0;text-align:center;user-select:all}}
 a{{color:#38bdf8}}
 .ok{{display:inline-block;background:#065f46;color:#6ee7b7;padding:3px 10px;
   border-radius:20px;font-size:12px}}
</style></head><body><div class="caja">
<span class="ok">servidor activo</span>
<h1>Sistema contable · Taller de motos</h1>
<p>Escriba esta direccion en la app movil, en la pantalla de conexion:</p>
<code>{url}</code>
<p>El celular debe estar en la <b>misma red WiFi</b> que este computador.</p>
<p>Documentacion de la API: <a href="/docs">/docs</a></p>
</div></body></html>"""
