/** Tipos del dominio.
 *
 * NO se escriben a mano: son alias sobre `openapi.d.ts`, que se regenera del
 * esquema OpenAPI que publica el backend (`npm run api:types`). Asi un cambio
 * en `schemas.py` rompe la compilacion del frontend en vez de fallar en tiempo
 * de ejecucion.
 */
import type { components } from './openapi';

type S = components['schemas'];

// ------------------------------------------------------------------ uniones
export type FormaPago = NonNullable<S['VentaIn']['forma_pago']>;
export type MetodoPago = NonNullable<S['VentaIn']['metodo']>;
export type MetodoGasto = NonNullable<S['GastoIn']['metodo']>;
export type TipoTercero = NonNullable<S['TerceroIn']['tipo']>;
export type EstadoOrden = NonNullable<S['OrdenIn']['estado']>;

// ---------------------------------------------------------------- catalogos
export type Cuenta = S['CuentaOut'];
export type Tercero = S['TerceroOut'];
export type Moto = S['MotoOut'];
export type Categoria = S['CategoriaOut'];
export type Producto = S['ProductoOut'];
export type ProductoValorizado = S['InventarioItem'];
export type Servicio = S['ServicioOut'];
export type MovimientoKardex = S['KardexOut'];

// -------------------------------------------------------------------- ventas
export type LineaVentaEntrada = S['VentaLineaIn'];
export type LineaVenta = S['VentaLineaOut'];
export type Venta = S['VentaOut'];
export type VentaDetalle = S['VentaDetalle'];
export type Pago = S['PagoOut'];

// ------------------------------------------------------------------ compras
export type LineaCompraEntrada = S['CompraLineaIn'];
export type Compra = S['CompraOut'];
export type CompraDetalle = S['CompraDetalle'];

// ------------------------------------------------------------------- gastos
export type Gasto = S['GastoOut'];

// ------------------------------------------------------------------ ordenes
export type ItemOrdenEntrada = S['OrdenItemIn'];
export type ItemOrden = S['OrdenItemOut'];
export type Orden = S['OrdenOut'];
export type OrdenDetalle = S['OrdenDetalle'];

// ----------------------------------------------------------------- informes
export type SaldoCuenta = S['SaldoCuenta'];
export type EstadoResultados = S['EstadoResultados'];
export type BalanceGeneral = S['BalanceGeneral'];
export type Dashboard = S['Dashboard'];
export type FilaCartera = S['FilaCartera'];
export type Cartera = S['Cartera'];
export type InventarioValorizado = S['InventarioValorizado'];
export type Asiento = S['AsientoOut'];
export type FlujoCaja = S['FlujoCaja'];
export type Impuestos = S['Impuestos'];

// ------------------------------------------------------------------ sistema
export type EstadoSistema = S['EstadoSistema'];
export type Creado = S['CreadoOut'];
export type Configuracion = Record<string, string>;
