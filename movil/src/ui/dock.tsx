/**
 * Dock inferior flotante (DESIGN/20-mobile.md §3).
 *
 * Cinco destinos: Panel · Vender · Ordenes · Inventario · Mas. Cinco es el
 * techo; un sexto destino va dentro de «Mas».
 */
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { forma } from './tema';
import { useTema } from './temaProveedor';

/** Geometria del dock. Se calcula, no se escribe a mano en cada pantalla. */
export const dock = {
  margenSuperior: 10,
  margenLateral: 14,
  rellenoVidrio: 12,
  interior: 60,
  pildora: 52,
  icono: 24,
};

const cuerpo = dock.rellenoVidrio * 2 + dock.interior; // 84

/**
 * Cuanto tiene que reservar una pantalla abajo para que el dock no tape
 * contenido. Un numero magico local se rompe en el primer telefono con otra
 * barra de gestos.
 */
export function useSolapeDock() {
  const inset = useSafeAreaInsets();
  const piso = Platform.OS === 'ios' ? 12 : 10;
  return dock.margenSuperior + cuerpo + Math.max(inset.bottom, piso);
}

export function Dock({ state, descriptors, navigation }: BottomTabBarProps) {
  const { c, modo, sombra } = useTema();
  const inset = useSafeAreaInsets();
  const piso = Platform.OS === 'ios' ? 12 : 10;
  const intensidad = Platform.OS === 'android' ? 40 * 1.4 : 40;

  return (
    <View
      pointerEvents="box-none"
      style={[
        e.envoltorio,
        { paddingBottom: Math.max(inset.bottom, piso), paddingTop: dock.margenSuperior },
      ]}
    >
      <BlurView
        intensity={intensidad}
        tint={modo === 'claro' ? 'light' : 'dark'}
        // En Android el BlurView sin esto solo dibuja un velo semitransparente.
        experimentalBlurMethod="dimezisBlurView"
        blurReductionFactor={3}
        style={[e.vidrio, { backgroundColor: c.dockFondo, borderColor: c.linea }, sombra]}
      >
        {state.routes.map((ruta, i) => {
          const { options } = descriptors[ruta.key];
          const activo = state.index === i;
          const rotulo = (options.title ?? ruta.name) as string;
          const color = activo ? c.sobreMarca : c.dockInactivo;

          return (
            <Pressable
              key={ruta.key}
              accessibilityRole="button"
              accessibilityState={activo ? { selected: true } : {}}
              accessibilityLabel={rotulo}
              onPress={() => {
                const evento = navigation.emit({
                  type: 'tabPress',
                  target: ruta.key,
                  canPreventDefault: true,
                });
                if (!activo && !evento.defaultPrevented) navigation.navigate(ruta.name);
              }}
              style={e.destino}
            >
              <View
                style={[
                  e.pildora,
                  activo && { backgroundColor: c.dockActivo, paddingHorizontal: 12 },
                ]}
              >
                {options.tabBarIcon?.({ focused: activo, color, size: dock.icono })}
                {activo && (
                  <Text numberOfLines={1} style={[e.rotulo, { color: c.sobreMarca }]}>
                    {rotulo}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const e = StyleSheet.create({
  envoltorio: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: dock.margenLateral,
  },
  vidrio: {
    flexDirection: 'row',
    alignItems: 'center',
    height: cuerpo,
    paddingHorizontal: dock.rellenoVidrio,
    borderRadius: forma.vidrio,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  destino: {
    flex: 1,
    height: dock.interior,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: dock.pildora,
    minWidth: dock.pildora,
    paddingHorizontal: 8,
    borderRadius: forma.pildora,
    justifyContent: 'center',
  },
  rotulo: { fontSize: 12.5, fontWeight: '700', letterSpacing: -0.1 },
});
