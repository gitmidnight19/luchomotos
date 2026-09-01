/**
 * Paleta de Taller Motos Lucho. Canon: DESIGN/00-fundamentos.md y DESIGN/20-mobile.md.
 *
 * Aqui viven los valores; ninguna pantalla escribe un hex. Las pantallas piden
 * el color a `useTema()` y reciben la paleta del modo activo.
 */
import { configureFonts, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export type Modo = 'claro' | 'oscuro';

/** Los tres colores de marca. No cambian con el modo: son la identidad. */
export const marca = {
  rojo: '#B11212',
  rojoElevado: '#E5484D', // el rojo legible sobre fondo oscuro
  negro: '#0B0B0B',
  azul: '#2A78D6',
  azulElevado: '#5598E7',
} as const;

const claro = {
  texto: '#1C1C1E',
  suave: '#6B6B6F',
  tenue: '#AEAEB2',
  fondo: '#F2F2F7',
  superficie: '#FFFFFF',
  tarjeta: '#FFFFFF',
  campo: '#F2F2F7',
  velo: 'rgba(0,0,0,.45)',
  linea: '#E5E5EA',
  separador: '#D1D1D6',
  marca: marca.rojo,
  marcaSuave: '#FDECEC',
  sobreMarca: '#FFFFFF',
  acento: marca.azul,
  acentoSuave: '#EAF2FD',
  tinta: marca.negro,
  icono: '#8E8E93',
  dockActivo: marca.rojo,
  dockInactivo: '#8E8E93',
  dockFondo: 'rgba(255,255,255,.85)',
  peligro: '#FF3B30',
  peligroSuave: '#FDECEC',
  bien: '#34C759',
  bienSuave: '#E8F7EE',
  atencion: '#FF9500',
  atencionSuave: '#FFF3E4',
  info: '#007AFF',
  infoSuave: '#E7F1FF',
  brilloBase: '#E8E8ED',
  brilloAlto: '#F5F5FA',
};

export type Paleta = Record<keyof typeof claro, string>;

const oscuro: Paleta = {
  texto: '#F2F2F7',
  suave: '#ABABAF',
  tenue: '#636366',
  fondo: '#0D0D0F',
  superficie: '#1C1C1E',
  tarjeta: '#242428',
  campo: '#2C2C2E',
  velo: 'rgba(0,0,0,.72)',
  linea: '#38383A',
  separador: '#2C2C2E',
  marca: marca.rojoElevado,
  marcaSuave: '#3A1517',
  sobreMarca: '#FFFFFF',
  acento: marca.azulElevado,
  acentoSuave: '#132A45',
  tinta: marca.negro,
  icono: '#8D8D93',
  dockActivo: marca.rojoElevado,
  dockInactivo: '#8D8D93',
  dockFondo: 'rgba(18,18,20,.88)',
  peligro: '#FF453A',
  peligroSuave: '#3A1517',
  bien: '#32D74B',
  bienSuave: '#12331C',
  atencion: '#FFD60A',
  atencionSuave: '#3A3113',
  info: '#0A84FF',
  infoSuave: '#132A45',
  brilloBase: '#2C2C2E',
  brilloAlto: '#3A3A3C',
};

export const paletas: Record<Modo, Paleta> = { claro, oscuro };

/**
 * Series de grafica. Se asignan en orden, nunca en ciclo: una octava serie se
 * agrupa en «Otros» o se parte en varias graficas.
 */
export const series: Record<Modo, readonly string[]> = {
  claro: ['#B11212', '#2A78D6', '#12996D', '#A8730A', '#4A3AA7', '#CF5F88', '#0B7A3F'],
  oscuro: ['#E5484D', '#5598E7', '#2CC08A', '#D19A27', '#8C7BE0', '#E88BB0', '#3FA96B'],
};

/** El color de las series que no son el punto de la historia. */
export const contexto: Record<Modo, string> = { claro: '#C9C7C1', oscuro: '#4A4A4E' };

/** Rojo pierde, azul gana. Sirve para margen, saldo y diferencia contra el mes pasado. */
export const divergente = {
  negativo: ['#8E0E0E', '#B11212', '#FF5961', '#FF9499'],
  neutro: '#EFEEEB',
  positivo: ['#9EC5F4', '#5598E7', '#2A78D6', '#184F95'],
} as const;

/** Forma: radios, rellenos y el area de toque minima. */
export const forma = {
  vidrio: 24,
  tarjeta: 16,
  anidado: 14,
  interior: 12,
  pildora: 999,
  relleno: 16,
  rellenoFila: 14,
  toque: 44,
} as const;

/** La sombra tine de rojo, no de negro. Sobre negro la opacidad tiene que subir. */
export function sombraMarca(modo: Modo) {
  return {
    shadowColor: modo === 'claro' ? marca.rojo : marca.rojoElevado,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: modo === 'claro' ? 0.2 : 0.35,
    shadowRadius: 12,
    elevation: 5,
  };
}

const fuentes = configureFonts({ config: { letterSpacing: 0 } });

/** El tema de React Native Paper derivado de la paleta activa. */
export function temaPaper(modo: Modo) {
  const c = paletas[modo];
  const base = modo === 'claro' ? MD3LightTheme : MD3DarkTheme;
  return {
    ...base,
    roundness: forma.interior,
    colors: {
      ...base.colors,
      primary: c.marca,
      onPrimary: c.sobreMarca,
      primaryContainer: c.marcaSuave,
      onPrimaryContainer: c.marca,
      secondary: c.acento,
      onSecondary: '#FFFFFF',
      secondaryContainer: c.acentoSuave,
      onSecondaryContainer: c.acento,
      tertiary: c.suave,
      background: c.fondo,
      onBackground: c.texto,
      surface: c.superficie,
      surfaceVariant: c.campo,
      onSurface: c.texto,
      onSurfaceVariant: c.suave,
      outline: c.linea,
      outlineVariant: c.linea,
      error: c.peligro,
      errorContainer: c.peligroSuave,
      onErrorContainer: c.peligro,
      elevation: {
        ...base.colors.elevation,
        level0: 'transparent',
        level1: c.superficie,
        level2: c.tarjeta,
        level3: c.tarjeta,
        level4: c.tarjeta,
        level5: c.tarjeta,
      },
    },
    fonts: fuentes,
  };
}

export type TemaPaper = ReturnType<typeof temaPaper>;
