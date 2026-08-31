/** Hooks de datos sobre React Query: una fuente de verdad por recurso. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DELETE, GET, POST, PUT } from './cliente';
import type {
  Asiento,
  BalanceGeneral,
  Cartera,
  Categoria,
  Compra,
  CompraDetalle,
  Configuracion,
  Creado,
  Cuenta,
  Dashboard,
  EstadoResultados,
  EstadoSistema,
  FlujoCaja,
  Gasto,
  Impuestos,
  InventarioValorizado,
  Moto,
  MovimientoKardex,
  Orden,
  OrdenDetalle,
  Pago,
  Producto,
  Servicio,
  Tercero,
  Venta,
  VentaDetalle,
} from './tipos';

export const claves = {
  estado: ['estado'] as const,
  config: ['config'] as const,
  cuentas: ['cuentas'] as const,
  dashboard: ['dashboard'] as const,
  terceros: (tipo?: string) => ['terceros', tipo ?? 'todos'] as const,
  motos: (clienteId?: number) => ['motos', clienteId ?? 'todas'] as const,
  productos: (q?: string) => ['productos', q ?? ''] as const,
  servicios: ['servicios'] as const,
  categorias: ['categorias'] as const,
  inventario: ['inventario'] as const,
  kardex: (id: number) => ['kardex', id] as const,
  ventas: (desde: string, hasta: string) => ['ventas', desde, hasta] as const,
  venta: (id: number) => ['venta', id] as const,
  compras: (desde: string, hasta: string) => ['compras', desde, hasta] as const,
  compra: (id: number) => ['compra', id] as const,
  ordenes: (estado?: string) => ['ordenes', estado ?? 'todas'] as const,
  orden: (id: number) => ['orden', id] as const,
  gastos: (desde: string, hasta: string) => ['gastos', desde, hasta] as const,
  pagos: (desde: string, hasta: string) => ['pagos', desde, hasta] as const,
  cartera: ['cartera'] as const,
  resultados: (desde: string, hasta: string) => ['resultados', desde, hasta] as const,
  balance: (hasta: string) => ['balance', hasta] as const,
  diario: (desde: string, hasta: string) => ['diario', desde, hasta] as const,
  flujo: (desde: string, hasta: string) => ['flujo', desde, hasta] as const,
  impuestos: (desde: string, hasta: string) => ['impuestos', desde, hasta] as const,
};

/** Todo lo que cambia cuando se registra un documento contable. */
const GRUPOS_A_REFRESCAR = [
  'estado',
  'dashboard',
  'productos',
  'inventario',
  'kardex',
  'ventas',
  'venta',
  'compras',
  'compra',
  'ordenes',
  'orden',
  'gastos',
  'pagos',
  'cartera',
  'resultados',
  'balance',
  'diario',
  'flujo',
  'impuestos',
  'terceros',
];

export function useRefrescarTodo() {
  const cliente = useQueryClient();
  return () =>
    Promise.all(
      GRUPOS_A_REFRESCAR.map((grupo) => cliente.invalidateQueries({ queryKey: [grupo] })),
    );
}

// ------------------------------------------------------------------ sistema
export const useEstado = () =>
  useQuery({ queryKey: claves.estado, queryFn: () => GET<EstadoSistema>('/api/estado') });

export const useConfig = () =>
  useQuery({ queryKey: claves.config, queryFn: () => GET<Configuracion>('/api/config') });

export function useGuardarConfig() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (valores: Configuracion) => PUT<Configuracion>('/api/config', valores),
    onSuccess: (datos) => {
      cliente.setQueryData(claves.config, datos);
      cliente.invalidateQueries({ queryKey: claves.estado });
    },
  });
}

export const useCuentas = () =>
  useQuery({ queryKey: claves.cuentas, queryFn: () => GET<Cuenta[]>('/api/cuentas') });

export const useDashboard = () =>
  useQuery({
    queryKey: claves.dashboard,
    queryFn: () => GET<Dashboard>('/api/informes/dashboard'),
  });

// ----------------------------------------------------------------- catalogos
export const useTerceros = (tipo?: 'cliente' | 'proveedor') =>
  useQuery({
    queryKey: claves.terceros(tipo),
    queryFn: () => GET<Tercero[]>('/api/terceros', { tipo }),
  });

export const useMotos = (clienteId?: number) =>
  useQuery({
    queryKey: claves.motos(clienteId),
    queryFn: () => GET<Moto[]>('/api/motos', { cliente_id: clienteId }),
  });

export const useProductos = (q?: string) =>
  useQuery({
    queryKey: claves.productos(q),
    queryFn: () => GET<Producto[]>('/api/productos', { q }),
  });

export const useServicios = () =>
  useQuery({ queryKey: claves.servicios, queryFn: () => GET<Servicio[]>('/api/servicios') });

export const useCategorias = () =>
  useQuery({ queryKey: claves.categorias, queryFn: () => GET<Categoria[]>('/api/categorias') });

export const useInventario = () =>
  useQuery({
    queryKey: claves.inventario,
    queryFn: () => GET<InventarioValorizado>('/api/informes/inventario'),
  });

export const useKardex = (id: number) =>
  useQuery({
    queryKey: claves.kardex(id),
    queryFn: () => GET<MovimientoKardex[]>(`/api/inventario/kardex/${id}`),
    enabled: Number.isFinite(id),
  });

// ------------------------------------------------------------------- ventas
export const useVentas = (desde: string, hasta: string, soloPendientes = false) =>
  useQuery({
    queryKey: [...claves.ventas(desde, hasta), soloPendientes],
    queryFn: () => GET<Venta[]>('/api/ventas', { desde, hasta, solo_pendientes: soloPendientes }),
  });

export const useVenta = (id: number) =>
  useQuery({
    queryKey: claves.venta(id),
    queryFn: () => GET<VentaDetalle>(`/api/ventas/${id}`),
    enabled: Number.isFinite(id),
  });

// ------------------------------------------------------------------ compras
export const useCompras = (desde: string, hasta: string) =>
  useQuery({
    queryKey: claves.compras(desde, hasta),
    queryFn: () => GET<Compra[]>('/api/compras', { desde, hasta }),
  });

export const useCompra = (id: number) =>
  useQuery({
    queryKey: claves.compra(id),
    queryFn: () => GET<CompraDetalle>(`/api/compras/${id}`),
    enabled: Number.isFinite(id),
  });

// ------------------------------------------------------------------ ordenes
export const useOrdenes = (estado?: string) =>
  useQuery({
    queryKey: claves.ordenes(estado),
    queryFn: () => GET<Orden[]>('/api/ordenes', { estado }),
  });

export const useOrden = (id: number) =>
  useQuery({
    queryKey: claves.orden(id),
    queryFn: () => GET<OrdenDetalle>(`/api/ordenes/${id}`),
    enabled: Number.isFinite(id) && id > 0,
  });

// ------------------------------------------------------- gastos y tesoreria
export const useGastos = (desde: string, hasta: string) =>
  useQuery({
    queryKey: claves.gastos(desde, hasta),
    queryFn: () => GET<Gasto[]>('/api/gastos', { desde, hasta }),
  });

export const usePagos = (desde: string, hasta: string) =>
  useQuery({
    queryKey: claves.pagos(desde, hasta),
    queryFn: () => GET<Pago[]>('/api/pagos', { desde, hasta }),
  });

export const useCartera = () =>
  useQuery({ queryKey: claves.cartera, queryFn: () => GET<Cartera>('/api/informes/cartera') });

// ----------------------------------------------------------------- informes
export const useResultados = (desde: string, hasta: string) =>
  useQuery({
    queryKey: claves.resultados(desde, hasta),
    queryFn: () => GET<EstadoResultados>('/api/informes/estado-resultados', { desde, hasta }),
  });

export const useBalance = (hasta: string) =>
  useQuery({
    queryKey: claves.balance(hasta),
    queryFn: () => GET<BalanceGeneral>('/api/informes/balance', { hasta }),
  });

export const useDiario = (desde: string, hasta: string) =>
  useQuery({
    queryKey: claves.diario(desde, hasta),
    queryFn: () => GET<Asiento[]>('/api/informes/libro-diario', { desde, hasta }),
  });

export const useFlujo = (desde: string, hasta: string) =>
  useQuery({
    queryKey: claves.flujo(desde, hasta),
    queryFn: () => GET<FlujoCaja>('/api/informes/flujo', { desde, hasta }),
  });

export const useImpuestos = (desde: string, hasta: string) =>
  useQuery({
    queryKey: claves.impuestos(desde, hasta),
    queryFn: () => GET<Impuestos>('/api/informes/impuestos', { desde, hasta }),
  });

// ---------------------------------------------------------------- mutaciones
/** Envuelve una mutacion y refresca todo lo que dependa de la contabilidad. */
function useMutacionContable<TEntrada, TSalida>(fn: (datos: TEntrada) => Promise<TSalida>) {
  const refrescar = useRefrescarTodo();
  return useMutation({ mutationFn: fn, onSuccess: () => refrescar() });
}

export const useCrearVenta = () =>
  useMutacionContable((datos: unknown) => POST<Creado>('/api/ventas', datos));

export const useAnularVenta = () =>
  useMutacionContable((id: number) => POST<{ ok: boolean }>(`/api/ventas/${id}/anular`));

export const useCrearCompra = () =>
  useMutacionContable((datos: unknown) => POST<Creado>('/api/compras', datos));

export const useAnularCompra = () =>
  useMutacionContable((id: number) => POST<{ ok: boolean }>(`/api/compras/${id}/anular`));

export const useCrearGasto = () =>
  useMutacionContable((datos: unknown) => POST<Creado>('/api/gastos', datos));

export const useAnularGasto = () =>
  useMutacionContable((id: number) => POST<{ ok: boolean }>(`/api/gastos/${id}/anular`));

export const useRegistrarPago = () =>
  useMutacionContable((datos: unknown) => POST<Creado>('/api/pagos', datos));

export const useTraslado = () =>
  useMutacionContable((datos: unknown) => POST<Creado>('/api/traslados', datos));

export const useAjustarInventario = () =>
  useMutacionContable((datos: unknown) =>
    POST<{ ok: boolean; delta: number }>('/api/inventario/ajuste', datos),
  );

export const useCrearOrden = () =>
  useMutacionContable((datos: unknown) => POST<Creado>('/api/ordenes', datos));

export const useEditarOrden = () =>
  useMutacionContable(({ id, datos }: { id: number; datos: unknown }) =>
    PUT<Creado>(`/api/ordenes/${id}`, datos),
  );

export const useFacturarOrden = () =>
  useMutacionContable(({ id, datos }: { id: number; datos: unknown }) =>
    POST<Creado>(`/api/ordenes/${id}/facturar`, datos),
  );

export const useAnularOrden = () =>
  useMutacionContable((id: number) => DELETE<{ ok: boolean }>(`/api/ordenes/${id}`));

export const useGuardarTercero = () =>
  useMutacionContable(({ id, datos }: { id?: number; datos: unknown }) =>
    id ? PUT<Tercero>(`/api/terceros/${id}`, datos) : POST<Tercero>('/api/terceros', datos),
  );

export const useBorrarTercero = () =>
  useMutacionContable((id: number) => DELETE<{ ok: boolean }>(`/api/terceros/${id}`));

export const useGuardarMoto = () =>
  useMutacionContable(({ id, datos }: { id?: number; datos: unknown }) =>
    id ? PUT<Moto>(`/api/motos/${id}`, datos) : POST<Moto>('/api/motos', datos),
  );

export const useBorrarMoto = () =>
  useMutacionContable((id: number) => DELETE<{ ok: boolean }>(`/api/motos/${id}`));

export const useGuardarProducto = () =>
  useMutacionContable(({ id, datos }: { id?: number; datos: unknown }) =>
    id ? PUT<Producto>(`/api/productos/${id}`, datos) : POST<Producto>('/api/productos', datos),
  );

export const useBorrarProducto = () =>
  useMutacionContable((id: number) => DELETE<{ ok: boolean }>(`/api/productos/${id}`));

export const useGuardarServicio = () =>
  useMutacionContable(({ id, datos }: { id?: number; datos: unknown }) =>
    id ? PUT<Servicio>(`/api/servicios/${id}`, datos) : POST<Servicio>('/api/servicios', datos),
  );

export const useBorrarServicio = () =>
  useMutacionContable((id: number) => DELETE<{ ok: boolean }>(`/api/servicios/${id}`));

export const useCargarDemo = () => useMutacionContable(() => POST<{ ok: boolean }>('/api/demo'));

export const useLimpiarDatos = () =>
  useMutacionContable(() => DELETE<{ ok: boolean }>('/api/demo'));
