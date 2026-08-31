/** Tema visual de la app (Material Design 3 sobre React Native Paper). */
import { configureFonts, MD3LightTheme } from 'react-native-paper';

export const colores = {
  marca: '#1d4ed8',
  marcaOscura: '#1e3a8a',
  marcaSuave: '#eef3ff',
  fondo: '#f4f6fa',
  superficie: '#ffffff',
  texto: '#1c2434',
  suave: '#6b7791',
  linea: '#e3e8f0',
  ok: '#0f9d58',
  okSuave: '#e8f7ee',
  alerta: '#c2410c',
  alertaSuave: '#fff3e8',
  error: '#dc2626',
  errorSuave: '#fdecec',
};

export const tema = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: colores.marca,
    onPrimary: '#ffffff',
    primaryContainer: colores.marcaSuave,
    onPrimaryContainer: colores.marcaOscura,
    secondary: colores.suave,
    background: colores.fondo,
    surface: colores.superficie,
    surfaceVariant: '#eef1f6',
    onSurface: colores.texto,
    onSurfaceVariant: colores.suave,
    outline: colores.linea,
    outlineVariant: colores.linea,
    error: colores.error,
    errorContainer: colores.errorSuave,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: '#ffffff',
      level2: '#ffffff',
      level3: '#ffffff',
    },
  },
  fonts: configureFonts({ config: { letterSpacing: 0 } }),
};

export type Tema = typeof tema;
