/** Selector de periodo con rangos rapidos (evita teclear fechas en el celular). */
import { useMemo, useState } from 'react';

import { haceDias, hoy, isoLocal, primerDiaAnio, primerDiaMes } from '../lib/formato';
import { Opciones } from './componentes';

export type Rango = 'hoy' | 'mes' | 'anterior' | 'anio';

const ETIQUETAS: { valor: Rango; texto: string }[] = [
  { valor: 'hoy', texto: 'Hoy' },
  { valor: 'mes', texto: 'Este mes' },
  { valor: 'anterior', texto: 'Mes pasado' },
  { valor: 'anio', texto: 'Este año' },
];

export function calcularRango(rango: Rango): { desde: string; hasta: string } {
  const ahora = new Date();
  switch (rango) {
    case 'hoy':
      return { desde: hoy(), hasta: hoy() };
    case 'anterior': {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
      const fin = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
      return { desde: isoLocal(inicio), hasta: isoLocal(fin) };
    }
    case 'anio':
      return { desde: primerDiaAnio(), hasta: hoy() };
    default:
      return { desde: primerDiaMes(), hasta: hoy() };
  }
}

export function usePeriodo(inicial: Rango = 'mes') {
  const [rango, setRango] = useState<Rango>(inicial);
  const { desde, hasta } = useMemo(() => calcularRango(rango), [rango]);
  const control = <Opciones valor={rango} onCambio={setRango} opciones={ETIQUETAS} />;
  return { rango, desde, hasta, control };
}

export { haceDias };
