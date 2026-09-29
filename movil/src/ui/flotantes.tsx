/**
 * Controles flotantes (DESIGN/20-mobile.md §3).
 *
 * La app no dibuja barra superior. Los dos controles que vivian en el header
 * —volver y la accion principal— flotan sobre el contenido: el volver arriba a
 * la izquierda, en vidrio, siempre visible; la accion abajo a la derecha, al
 * alcance del pulgar.
 *
 * La geometria vive aqui. Una pantalla que se calcula el «bottom» a mano se
 * rompe en el primer telefono con otra barra de gestos.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSolapeDock } from './dock';
import { forma } from './tema';
import { useTema } from './temaProveedor';

export type Icono = keyof typeof MaterialCommunityIcons.glyphMap;

/** La accion principal de una pantalla, en pildora flotante. */
export type AccionFlotante = {
  rotulo: string;
  onPress: () => void;
  icono?: Icono;
};

/** Geometria de los flotantes. Ninguna pantalla escribe estos numeros. */
export const flotante = {
  /** Diametro del boton de volver. Es tambien su area de toque. */
  volver: 44,
  /** Alto de la pildora de accion. */
  accion: 52,
  /** Separacion al borde de la pantalla. */
  margen: 14,
  /** Aire entre un flotante y el contenido que no debe tapar. */
  hueco: 12,
  /** Lo que el volver respira bajo la muesca. */
  respiro: 6,
} as const;

/** Lo que una pantalla reserva arriba: safe area mas el volver, si lo lleva. */
export function useHuecoSuperior(atras?: boolean) {
  const inset = useSafeAreaInsets();
  if (!atras) return inset.top + flotante.hueco;
  return inset.top + flotante.respiro + flotante.volver + 10;
}

/** Lo que una pantalla reserva abajo para que la pildora no tape contenido. */
export function useSueloAccion(dock?: boolean) {
  const inset = useSafeAreaInsets();
  const solape = useSolapeDock();
  return dock ? solape + 8 : Math.max(inset.bottom, 16) + 16;
}

/** Sin hover, la retroalimentacion es el estado presionado: el flotante cede. */
function usePresion(minimo = 0.94) {
  const escala = useSharedValue(1);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));
  return {
    estilo,
    onPressIn: () => {
      escala.set(withSpring(minimo, { damping: 18, stiffness: 320 }));
    },
    onPressOut: () => {
      escala.set(withSpring(1, { damping: 15, stiffness: 260 }));
    },
  };
}

/**
 * Volver. Reemplaza al back del header: mismo gesto de sistema (deslizar en
 * iOS, boton fisico en Android) mas un ancla visible en vidrio.
 */
export function Volver() {
  const { c, modo, sombra } = useTema();
  const inset = useSafeAreaInsets();
  const router = useRouter();
  const presion = usePresion();
  // En Android el BlurView rinde mas flojo: la intensidad se compensa.
  const intensidad = Platform.OS === 'android' ? 40 * 1.4 : 40;

  return (
    <Animated.View
      style={[
        estilo.sitioVolver,
        { top: inset.top + flotante.respiro, left: flotante.margen },
        presion.estilo,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        onPressIn={presion.onPressIn}
        onPressOut={presion.onPressOut}
      >
        <BlurView
          intensity={intensidad}
          tint={modo === 'claro' ? 'light' : 'dark'}
          experimentalBlurMethod="dimezisBlurView"
          blurReductionFactor={3}
          style={[estilo.volver, { backgroundColor: c.dockFondo, borderColor: c.linea }, sombra]}
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color={c.texto} />
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}

/**
 * La accion principal, flotando sobre el contenido.
 *
 * Unica excepcion a «los botones llevan solo texto»: sin barra superior esta
 * pildora es el ancla de la accion de la pantalla y el icono la hace legible de
 * un vistazo, con el pulgar encima.
 */
export function Accion({
  rotulo,
  onPress,
  icono = 'plus',
  dock,
}: AccionFlotante & { dock?: boolean }) {
  const { c, sombra } = useTema();
  const presion = usePresion(0.96);
  const suelo = useSueloAccion(dock);

  return (
    <Animated.View
      entering={ZoomIn.duration(260).delay(140)}
      style={[estilo.sitioAccion, { bottom: suelo, right: flotante.margen }, presion.estilo]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        onPress={onPress}
        onPressIn={presion.onPressIn}
        onPressOut={presion.onPressOut}
        style={({ pressed }) => [
          estilo.accion,
          { backgroundColor: c.marca, opacity: pressed ? 0.92 : 1 },
          sombra,
        ]}
      >
        <MaterialCommunityIcons name={icono} size={20} color={c.sobreMarca} />
        <Text style={[estilo.rotulo, { color: c.sobreMarca }]} numberOfLines={1}>
          {rotulo}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const estilo = StyleSheet.create({
  sitioVolver: { position: 'absolute', zIndex: 10 },
  volver: {
    width: flotante.volver,
    height: flotante.volver,
    borderRadius: flotante.volver / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sitioAccion: { position: 'absolute', zIndex: 10 },
  accion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: flotante.accion,
    paddingHorizontal: 20,
    borderRadius: forma.pildora,
  },
  rotulo: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
});
