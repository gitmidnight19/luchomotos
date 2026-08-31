# Taller Contable

Sistema contable de doble partida para un taller de motos. API HTTP + cliente
móvil, con SQLite como almacén.

```
movil/     Expo SDK 54 · React Native · TypeScript · expo-router · TanStack Query
   │       consume el contrato generado de OpenAPI
   ▼
backend/   FastAPI · Pydantic v2 · SQLAlchemy 2.0 · Alembic
   │
   ▼
data/taller.db
```

## Invariante central

Ninguna capa escribe asientos directamente: todo pasa por
`services/contabilidad.registrar_asiento`, que valida `debe == haber` antes de
persistir y aborta la transacción completa si no cuadra. `GET /api/estado`
expone la diferencia `activo − (pasivo + patrimonio)` y las pruebas la afirman
en cero tras cada recorrido de operaciones.

El invariante es **exacto**: los importes son enteros de centavos, así que no
hay tolerancia que justificar. `tests/test_propiedades.py` genera secuencias
aleatorias de operaciones con Hypothesis y verifica seis invariantes después de
cada paso — entre ellos que el mayor cuadre y que la cuenta de control 1435 ate
con el auxiliar de inventario.

**El dinero no se guarda en `float` en ninguna parte.** El costo promedio
tampoco se almacena: se guarda `productos.valor_inventario` en centavos y el
promedio se deriva al leer. Es lo que impide que la cuenta de control se
desligue del auxiliar, porque el asiento mueve exactamente el mismo entero.

## Capas

| Capa | Responsabilidad | Regla |
|---|---|---|
| `routers/` | HTTP, validación de entrada, serialización | Sin lógica de negocio |
| `services/` | Reglas del dominio y contabilización | No conoce FastAPI |
| `models.py` | Persistencia (SQLAlchemy 2.0) | Sin lógica |
| `schemas.py` | Contrato público | Fuente de los tipos del móvil |

`errores.ReglaNegocio` / `NoEncontrado` se traducen a 400 / 404 en un manejador
global de `main.py`; los servicios nunca importan `HTTPException`.

## Servidor MCP

`backend/mcp_taller.py` expone el negocio a un modelo en lenguaje natural:
*"¿cuánto vendí este mes y qué repuestos debo reponer?"*.

| Herramienta | Responde |
|---|---|
| `resumen_periodo` | ventas, costo, gastos, utilidad y margen del periodo |
| `repuestos_por_reponer` | qué está bajo el mínimo, con días de cobertura |
| `rentabilidad_por_producto` | cuáles dejan utilidad de verdad |
| `cartera_vencida` | quién debe, desde hace cuánto |
| `estado_financiero` | efectivo, inventario, cartera, patrimonio y cuadre |

Dos decisiones deliberadas:

- **Escritas a mano, no generadas del OpenAPI.** `FastMCP.from_fastapi()` habría
  producido ~40 herramientas CRUD, y la documentación de FastMCP advierte que los
  modelos rinden peor con APIs auto-convertidas que con servidores diseñados.
- **Solo lectura.** Un modelo no debe poder anular una factura. La superficie de
  escritura sigue siendo la app.

Corre en proceso contra la capa de servicios, sin HTTP ni autenticación de por
medio. Está registrado en `.mcp.json`; para inspeccionarlo:

```bash
uv run --directory backend fastmcp dev mcp_taller.py
```

## Contrato tipado

`movil/src/api/tipos.ts` **no se escribe a mano**: son alias sobre
`openapi.d.ts`, generado del esquema que publica la API.

```bash
npm run app:contract     # regenera desde http://localhost:8321/openapi.json
```

El CI regenera y hace `git diff --exit-code`: un cambio en `schemas.py` sin
actualizar el contrato rompe la build en vez de fallar en runtime.

## Puesta en marcha

Requiere [uv](https://docs.astral.sh/uv/) y Node 22+:

```bash
npm run setup            # uv sync (desde uv.lock) + npm install en movil
npm run hooks            # instala los ganchos de pre-commit
npm run api:migrate      # alembic upgrade head
```

El entorno de Python lo gestiona **uv** desde `backend/uv.lock`, que sí se
versiona: `uv sync --locked` reproduce exactamente las mismas versiones.

## Tareas

| Comando | Qué hace |
|---|---|
| `npm run api` | uvicorn con `--reload` en `0.0.0.0:8321` |
| `npm run hooks` | instala los ganchos de pre-commit |
| `npm run api:test` / `api:cov` | pytest / con cobertura |
| `npm run api:lint` / `api:fmt` / `api:types` | ruff check / ruff format / mypy |
| `npm run api:migrate` | `alembic upgrade head` |
| `npm run api:revision -- "mensaje"` | nueva migración autogenerada |
| `npm run app` | Metro (`expo start`) |
| `npm run app:lint` / `app:types` | eslint / tsc |
| `npm run app:contract` | regenera los tipos desde OpenAPI |
| `npm run check` | todo lo que corre el CI |
| `npm run clean` | borra cachés, bytecode y builds (no toca `data/`) |
| `npm run clean:deps` | además borra `movil/node_modules` |

## Configuración

Variables con prefijo `TALLER_` en `.env` (raíz) — ver `.env.example`.
`config.py` resuelve el `env_file` de forma **absoluta**, así que se lee igual
sea cual sea el CWD.

| Variable | Defecto |
|---|---|
| `TALLER_PUERTO` | `8321` |
| `TALLER_HOST` | `0.0.0.0` |
| `TALLER_DATA_DIR` | `<raíz>/data` |
| `TALLER_DB_NOMBRE` | `taller.db` |
| `TALLER_DEBUG` | `false` |

En `movil/.env`, `EXPO_PUBLIC_API_URL` fija la dirección por defecto del
servidor (debe ser la IP de red, no `localhost`). Lo que el usuario guarde en la
app tiene prioridad. Expo incrusta las `EXPO_PUBLIC_*` al compilar: tras
cambiarla hay que reiniciar con `expo start -c`.

## Modelo contable

- Inventario a **promedio ponderado**, recalculado en cada entrada.
- Plan de cuentas tipo PUC colombiano simplificado (`seed.py`).
- El signo del saldo sigue la naturaleza del **grupo**, no la de la cuenta, para
  que las cuentas de contrapartida (1592, 4175) resten dentro de su grupo.
- La utilidad del ejercicio se calcula en vivo dentro del patrimonio.

## Pendientes (por prioridad)

La app debe **seguir vendiendo sin red**, y eso reordena lo que falta. Tres
cimientos del código actual no lo soportan:

1. **ULID como clave.** 18 tablas usan PK entera autoincremental: el teléfono no
   puede generar identificadores sin hablar con el servidor.
2. **Series de numeración por dispositivo** (`FV-A-00001`). Hoy el número deriva
   del PK del servidor, así que no existe hasta sincronizar.
3. **Log de operaciones** y endpoint de sincronización idempotente. Encaja
   natural con contabilidad: los documentos ya son inmutables — una anulación es
   un documento nuevo, nunca un `UPDATE`.
4. **`expo-sqlite`** con cola local en el móvil.
5. **Política de conflicto de existencias**: aceptar y señalar, no rechazar. Si
   dos dispositivos venden la última unidad estando offline, el repuesto ya
   salió; negarlo al sincronizar sería negar un hecho.

Y lo que sigue pendiente al margen de eso:

6. **Invariante de existencias en la escritura.** `validar_existencias` lee y
   `mover` escribe: es check-then-act. Debe ser `UPDATE ... WHERE stock >= :n`
   más `CHECK (stock >= 0)`.
7. **`ventas.saldo` / `compras.saldo` denormalizados** frente a la tabla `pagos`.
8. **Paginación** en los listados (`ordenes` tiene un `LIMIT 300` hardcodeado).
9. **Invalidación de caché granular** en `movil/src/api/hooks.ts`: hoy
   `useMutacionContable` invalida 19 grupos por mutación.
10. **Sin autenticación.** Cualquiera en la red tiene lectura y escritura
    totales, incluido `DELETE /api/demo`.

## Estructura

```
.
├── package.json              orquestador de tareas (no tiene dependencias)
├── .env / .env.example       configuración del servidor
├── .pre-commit-config.yaml   14 ganchos: formato, tipos y linters
├── .gitattributes            normaliza a LF (evita churn en Windows)
├── .github/workflows/ci.yml  ruff · mypy · pytest · eslint · tsc · contrato
├── backend/
│   ├── pyproject.toml        dependencias y config de herramientas
│   ├── alembic/              migraciones
│   ├── tests/                65 pruebas + propiedades con Hypothesis
│   └── app/
│       ├── main.py config.py database.py errores.py
│       ├── models.py schemas.py seed.py demo.py deps.py
│       ├── services/         contabilidad · inventario · ventas · compras
│       │                     ordenes · tesoreria · informes
│       └── routers/          sistema · catalogos · operaciones · informes
└── movil/
    ├── AGENTS.md             por qué el SDK está fijado en 54
    ├── app/                  rutas (expo-router)
    └── src/{api,ui,lib}/     contrato, componentes, formato
```

## Ganchos de pre-commit

```bash
.venv/Scripts/pre-commit install     # una vez por clon
```

Corren ruff (+fix), ruff-format, mypy, Biome y ESLint sobre lo que se commitea,
más las verificaciones básicas (YAML/TOML/JSON válidos, sin claves privadas, sin
conflictos sin resolver, LF). Son idempotentes: una segunda pasada no modifica nada.

## Utillaje

| Herramienta | Para qué | Por qué esa |
|---|---|---|
| **uv** | entorno y dependencias de Python | lockfile reproducible; resuelve e instala en segundos |
| **ruff** | linter y formateador de Python | reemplaza flake8+isort+black en un binario |
| **mypy** | tipos de Python | el modo estricto atrapa `str` del ORM colándose donde el esquema exige `Literal` |
| **Biome** | formato del móvil | sustituye a Prettier: 32 archivos en ~116 ms |
| **ESLint** + `eslint-config-expo` | linting del móvil | **no** lo reemplaza Biome: aporta reglas de React Native que Biome no cubre |
| **openapi-typescript** | contrato TS | se genera del esquema; el CI falla si diverge |
