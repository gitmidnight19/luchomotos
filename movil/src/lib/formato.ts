/** Formato de dinero, cantidades y fechas para la interfaz. */

let simbolo = '$';
let decimales = 0;

export function configurarFormato(moneda?: string, dec?: string) {
  if (moneda) simbolo = moneda;
  if (dec !== undefined) decimales = Number.parseInt(dec, 10) || 0;
}

export function dinero(valor: number | null | undefined): string {
  const n = Number(valor ?? 0);
  const signo = n < 0 ? '-' : '';
  return `${signo}${simbolo} ${Math.abs(n).toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;
}

/** Version compacta para tarjetas: 1,2 M / 350 mil. */
export function dineroCorto(valor: number | null | undefined): string {
  const n = Number(valor ?? 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${simbolo} ${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (abs >= 10_000) return `${simbolo} ${Math.round(n / 1000)} mil`;
  return dinero(n);
}

export function cantidad(valor: number | null | undefined): string {
  const n = Number(valor ?? 0);
  return Number.isInteger(n) ? String(n) : n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

export function porcentaje(valor: number | null | undefined): string {
  return `${Number(valor ?? 0).toFixed(1)}%`;
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.substring(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.substring(0, 10).split('-');
  return `${d} ${MESES[Number(m) - 1] ?? ''} ${a}`;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function isoLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

export const hoy = () => isoLocal(new Date());

export const primerDiaMes = () => {
  const d = new Date();
  return isoLocal(new Date(d.getFullYear(), d.getMonth(), 1));
};

export const primerDiaAnio = () => `${new Date().getFullYear()}-01-01`;

export const haceDias = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return isoLocal(d);
};

/** Convierte texto escrito por el usuario a numero (acepta 1.500 y 1,5). */
export function aNumero(texto: string): number {
  if (!texto) return 0;
  const limpio = texto.replace(/[^\d,.-]/g, '');
  const normalizado =
    limpio.includes(',') && limpio.lastIndexOf(',') > limpio.lastIndexOf('.')
      ? limpio.replace(/\./g, '').replace(',', '.')
      : limpio.replace(/,/g, '');
  const n = Number.parseFloat(normalizado);
  return Number.isFinite(n) ? n : 0;
}
