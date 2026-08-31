/** Cliente HTTP del servidor del taller.
 *
 * La direccion del servidor la escribe el usuario una sola vez y queda
 * guardada en el telefono, para que la app arranque conectada.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_SERVIDOR = 'taller.servidor';

/** Direccion por defecto tomada de movil/.env (EXPO_PUBLIC_API_URL).
 *  Lo que el usuario guarde desde la app siempre tiene prioridad sobre esto. */
const SERVIDOR_POR_DEFECTO = process.env.EXPO_PUBLIC_API_URL ?? '';

let servidor: string | null = null;

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly estado: number,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

export function normalizarUrl(url: string): string {
  let limpia = url.trim().replace(/\/+$/, '');
  if (!limpia) return '';
  if (!/^https?:\/\//i.test(limpia)) limpia = `http://${limpia}`;
  // Si no trae puerto, se asume el del servidor del taller.
  if (!/:\d+$/.test(limpia.replace(/^https?:\/\//i, ''))) limpia = `${limpia}:8321`;
  return limpia;
}

export async function cargarServidor(): Promise<string | null> {
  if (servidor) return servidor;
  const guardado = await AsyncStorage.getItem(CLAVE_SERVIDOR);
  servidor = guardado ?? (SERVIDOR_POR_DEFECTO ? normalizarUrl(SERVIDOR_POR_DEFECTO) : null);
  return servidor;
}

export async function guardarServidor(url: string): Promise<void> {
  servidor = normalizarUrl(url);
  await AsyncStorage.setItem(CLAVE_SERVIDOR, servidor);
}

export async function olvidarServidor(): Promise<void> {
  servidor = null;
  await AsyncStorage.removeItem(CLAVE_SERVIDOR);
}

/** true si la direccion actual viene del .env y no la escribio el usuario. */
export function servidorEsPorDefecto(): boolean {
  return !!SERVIDOR_POR_DEFECTO && servidor === normalizarUrl(SERVIDOR_POR_DEFECTO);
}

export function servidorActual(): string | null {
  return servidor;
}

/** Comprueba que la direccion responda antes de guardarla. */
export async function probarServidor(url: string): Promise<{ ok: boolean; mensaje: string }> {
  const base = normalizarUrl(url);
  if (!base) return { ok: false, mensaje: 'Escriba la direccion del servidor' };
  try {
    const control = new AbortController();
    const tiempo = setTimeout(() => control.abort(), 6000);
    const respuesta = await fetch(`${base}/salud`, { signal: control.signal });
    clearTimeout(tiempo);
    if (!respuesta.ok) return { ok: false, mensaje: `El servidor respondio ${respuesta.status}` };
    const datos = await respuesta.json();
    return { ok: true, mensaje: `Conectado (version ${datos.version})` };
  } catch {
    return {
      ok: false,
      mensaje:
        'No se pudo conectar. Verifique la direccion y que el celular este en la misma red WiFi.',
    };
  }
}

type Opciones = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  cuerpo?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
};

export async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const base = servidor ?? (await cargarServidor());
  if (!base) throw new ErrorApi('Todavia no se ha configurado el servidor', 0);

  const url = new URL(`${base}${ruta}`);
  for (const [clave, valor] of Object.entries(opciones.params ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') {
      url.searchParams.set(clave, String(valor));
    }
  }

  const control = new AbortController();
  const tiempo = setTimeout(() => control.abort(), 20000);
  let respuesta: Response;
  try {
    respuesta = await fetch(url.toString(), {
      method: opciones.metodo ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      signal: control.signal,
    });
  } catch {
    throw new ErrorApi('Sin conexion con el servidor del taller', 0);
  } finally {
    clearTimeout(tiempo);
  }

  if (!respuesta.ok) {
    let detalle = `Error ${respuesta.status}`;
    try {
      const cuerpo = await respuesta.json();
      if (typeof cuerpo?.detail === 'string') {
        detalle = cuerpo.detail;
      } else if (Array.isArray(cuerpo?.detail)) {
        // Errores de validacion de FastAPI.
        detalle = cuerpo.detail
          .map((e: { loc?: (string | number)[]; msg?: string }) =>
            `${(e.loc ?? []).slice(1).join('.')}: ${e.msg ?? ''}`.trim(),
          )
          .join('\n');
      }
    } catch {
      /* la respuesta no traia JSON */
    }
    throw new ErrorApi(detalle, respuesta.status);
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export const GET = <T>(ruta: string, params?: Opciones['params']) => api<T>(ruta, { params });
export const POST = <T>(ruta: string, cuerpo?: unknown) =>
  api<T>(ruta, { metodo: 'POST', cuerpo: cuerpo ?? {} });
export const PUT = <T>(ruta: string, cuerpo?: unknown) =>
  api<T>(ruta, { metodo: 'PUT', cuerpo: cuerpo ?? {} });
export const DELETE = <T>(ruta: string) => api<T>(ruta, { metodo: 'DELETE' });
