/** Formato de dinero, cantidades y fechas.
 *
 * TODO importe que viaja por la API esta en CENTAVOS ENTEROS. TypeScript no
 * distingue enteros de decimales (ambos son `number`), asi que el compilador no
 * puede atrapar una confusion de unidades: la disciplina es que `centavos` solo
 * se convierte a pesos aqui, al formatear o al editar.
 */

let simbolo = '$';
let decimales = 0;

export function configurarFormato(moneda?: string, dec?: string) {
  if (moneda) simbolo = moneda;
  if (dec !== undefined) decimales = Number.parseInt(dec, 10) || 0;
}

/** Formatea un importe. Recibe CENTAVOS, muestra pesos. */
export function dinero(centavos: number | null | undefined): string {
  const pesos = Number(centavos ?? 0) / 100;
  const signo = pesos < 0 ? '-' : '';
  return `${signo}${simbolo} ${Math.abs(pesos).toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;
}

/** Version compacta para tarjetas: 1,2 M / 350 mil. Recibe centavos. */
export function dineroCorto(centavos: number | null | undefined): string {
  const pesos = Number(centavos ?? 0) / 100;
  const abs = Math.abs(pesos);
  if (abs >= 1_000_000) return `${simbolo} ${(pesos / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (abs >= 10_000) return `${simbolo} ${Math.round(pesos / 1000)} mil`;
  return dinero(centavos);
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

/** Centavos a pesos, para mostrarlos en un campo editable. */
export function enPesos(centavos: number | null | undefined): number {
  return Math.round(Number(centavos ?? 0)) / 100;
}

/** Texto en PESOS escrito por el usuario -> centavos enteros. */
export function aCentavos(texto: string): number {
  return Math.round(aNumero(texto) * 100);
}

/** Multiplica un precio en centavos por una cantidad, redondeando al centavo. */
export function multiplicar(centavos: number, cantidad: number): number {
  return Math.round(centavos * cantidad);
}

/** Aplica una tasa (IVA) sobre una base en centavos. */
export function tasa(base: number, pct: number): number {
  return Math.round((base * pct) / 100);
}

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
