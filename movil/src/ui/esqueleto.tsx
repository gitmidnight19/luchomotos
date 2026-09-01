/**
 * Estados de carga (DESIGN/20-mobile.md §4).
 *
 * `ActivityIndicator` esta prohibido en pantallas y secciones de contenido: el
 * contenido carga con esqueleto, el boton con su propio estado y el splash con
 * puntos. La transicion esqueleto -> contenido no puede mover el layout, asi
 * que cada preset imita la altura de lo que va a llegar.
 */
import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { forma } from './tema';
import { useTema } from './temaProveedor';

// ------------------------------------------------------------------- bloque
function Bloque({
  ancho = '100%',
  alto = 12,
  radio = 6,
  style,
}: {
  ancho?: ViewStyle['width'];
  alto?: number;
  radio?: number;
  style?: ViewStyle;
}) {
  const { c } = useTema();
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [p]);

  const animado = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [c.brilloBase, c.brilloAlto]),
  }));

  return (
    <Animated.View style={[{ width: ancho, height: alto, borderRadius: radio }, animado, style]} />
  );
}

// ------------------------------------------------------------------ piezas
function Tarjeta({ children }: { children: React.ReactNode }) {
  const { c } = useTema();
  return (
    <View style={[e.tarjeta, { backgroundColor: c.tarjeta, borderColor: c.linea }]}>
      {children}
    </View>
  );
}

function FilaEsq() {
  const { c } = useTema();
  return (
    <View style={[e.fila, { borderBottomColor: c.linea }]}>
      <View style={{ flex: 1, gap: 7 }}>
        <Bloque ancho="62%" alto={14} />
        <Bloque ancho="38%" alto={11} />
      </View>
      <Bloque ancho={72} alto={15} />
    </View>
  );
}

function MetricaEsq() {
  return (
    <Tarjeta>
      <View style={{ padding: forma.relleno, gap: 9 }}>
        <Bloque ancho="52%" alto={10} />
        <Bloque ancho="76%" alto={21} radio={7} />
        <Bloque ancho="44%" alto={11} />
      </View>
    </Tarjeta>
  );
}

export type Preset =
  | 'lista'
  | 'tarjeta'
  | 'panel'
  | 'metricas'
  | 'fila'
  | 'campo'
  | 'informe'
  | 'boton';

/**
 * Esqueleto de carga inicial. En listas con «tirar para refrescar» manda el
 * indicador del sistema: esto es solo para la primera carga.
 */
export function Esqueleto({ preset = 'lista', filas = 5 }: { preset?: Preset; filas?: number }) {
  const llaves = Array.from({ length: filas }, (_, i) => i);

  if (preset === 'boton') return <Bloque alto={44} radio={forma.pildora} />;

  if (preset === 'campo')
    return (
      <View style={{ gap: 7, marginBottom: 12 }}>
        <Bloque ancho="34%" alto={11} />
        <Bloque alto={48} radio={forma.interior} />
      </View>
    );

  if (preset === 'fila') return <FilaEsq />;

  if (preset === 'metricas')
    return (
      <View style={e.rejilla}>
        {llaves.slice(0, 4).map((k) => (
          <View key={k} style={{ width: '48%' }}>
            <MetricaEsq />
          </View>
        ))}
      </View>
    );

  if (preset === 'tarjeta')
    return (
      <Tarjeta>
        <View style={{ padding: forma.relleno, gap: 10 }}>
          <Bloque ancho="46%" alto={14} />
          <Bloque alto={11} />
          <Bloque ancho="82%" alto={11} />
        </View>
      </Tarjeta>
    );

  if (preset === 'informe')
    return (
      <Tarjeta>
        <View style={{ padding: forma.relleno, gap: 12 }}>
          <Bloque ancho="40%" alto={13} />
          {llaves.map((k) => (
            <View key={k} style={e.totalFila}>
              <Bloque ancho="46%" alto={12} />
              <Bloque ancho={84} alto={12} />
            </View>
          ))}
        </View>
      </Tarjeta>
    );

  if (preset === 'panel')
    return (
      <View>
        <View style={e.rejilla}>
          {[0, 1, 2, 3].map((k) => (
            <View key={k} style={{ width: '48%' }}>
              <MetricaEsq />
            </View>
          ))}
        </View>
        <Tarjeta>
          {llaves.slice(0, 3).map((k) => (
            <FilaEsq key={k} />
          ))}
        </Tarjeta>
      </View>
    );

  return (
    <Tarjeta>
      {llaves.map((k) => (
        <FilaEsq key={k} />
      ))}
    </Tarjeta>
  );
}

// ------------------------------------------------------------------- puntos
/** Solo para el splash y el porton de conexion. Nunca para contenido. */
export function Puntos({ color }: { color?: string }) {
  const { c } = useTema();
  const tono = color ?? c.marca;
  return (
    <View style={e.puntos}>
      {[0, 1, 2].map((i) => (
        <Punto key={i} indice={i} color={tono} />
      ))}
    </View>
  );
}

function Punto({ indice, color }: { indice: number; color: string }) {
  const p = useSharedValue(0.3);

  useEffect(() => {
    const id = setTimeout(() => {
      p.value = withRepeat(withTiming(1, { duration: 480 }), -1, true);
    }, indice * 160);
    return () => clearTimeout(id);
  }, [p, indice]);

  const animado = useAnimatedStyle(() => ({ opacity: p.value }));

  return <Animated.View style={[e.punto, { backgroundColor: color }, animado]} />;
}

const e = StyleSheet.create({
  tarjeta: {
    borderRadius: forma.tarjeta,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: forma.rellenoFila,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  puntos: { flexDirection: 'row', gap: 7 },
  punto: { width: 8, height: 8, borderRadius: 4 },
});
