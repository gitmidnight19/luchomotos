/**
 * Dock inferior flotante (DESIGN/20-mobile.md §3).
 *
 * Cinco destinos: Panel · Ordenes · Vender · Inventario · Mas. Cinco es el
 * techo; un sexto destino va dentro de «Mas».
 *
 * «Vender» sale de la fila y sube como boton circular de marca al centro: es
 * la accion que mas se repite en el mostrador, y al centro queda bajo el
 * pulgar con cualquiera de las dos manos. Los otros cuatro van rotulados.
 */
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { forma } from './tema';
import { useTema } from './temaProveedor';

/** Geometria del dock. Se calcula, no se escribe a mano en cada pantalla. */
export const dock = {
  margenSuperior: 10,
  margenLateral: 14,
  rellenoHorizontal: 12,
  rellenoVertical: 6,
  interior: 60,
  icono: 24,
  /** El boton central: diametro y cuanto sobresale por encima de la barra. */
  central: 60,
  sobresale: 22,
};

/** La ruta que sale de la fila y sube como boton. */
const RUTA_CENTRAL = 'venta';

const cuerpo = dock.rellenoVertical * 2 + dock.interior; // 72

function usePiso() {
  const inset = useSafeAreaInsets();
  return Math.max(inset.bottom, Platform.OS === 'ios' ? 12 : 10);
}

/**
 * Cuanto tiene que reservar una pantalla abajo para que el dock no tape
 * contenido. Un numero magico local se rompe en el primer telefono con otra
 * barra de gestos.
 */
export function useSolapeDock() {
  return dock.margenSuperior + dock.sobresale + cuerpo + usePiso();
}

type Destino = {
  clave: string;
  nombre: string;
  rotulo: string;
  activo: boolean;
  icono: (color: string, size: number) => ReactNode;
  ir: () => void;
};

/** Lo que el dock necesita de cada ruta, con la logica de navegacion ya resuelta. */
function destinos({ state, descriptors, navigation }: BottomTabBarProps): Destino[] {
  return state.routes.map((ruta, i) => {
    const { options } = descriptors[ruta.key];
    const activo = state.index === i;
    return {
      clave: ruta.key,
      nombre: ruta.name,
      rotulo: (options.title ?? ruta.name) as string,
      activo,
      icono: (color, size) => options.tabBarIcon?.({ focused: activo, color, size }),
      ir: () => {
        const evento = navigation.emit({
          type: 'tabPress',
          target: ruta.key,
          canPreventDefault: true,
        });
        if (!activo && !evento.defaultPrevented) navigation.navigate(ruta.name);
      },
    };
  });
}

export function Dock(props: BottomTabBarProps) {
  const { c, modo, sombra } = useTema();
  const piso = usePiso();

  const lista = destinos(props);
  const central = lista.find((d) => d.nombre === RUTA_CENTRAL);
  const resto = lista.filter((d) => d !== central);
  const mitad = Math.ceil(resto.length / 2);

  return (
    <View
      pointerEvents="box-none"
      style={[
        e.envoltorio,
        { paddingBottom: piso, paddingTop: dock.margenSuperior + dock.sobresale },
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'android' ? 40 * 1.4 : 40}
        tint={modo === 'claro' ? 'light' : 'dark'}
        // En Android el BlurView sin esto solo dibuja un velo semitransparente.
        experimentalBlurMethod="dimezisBlurView"
        blurReductionFactor={3}
        style={[e.vidrio, { backgroundColor: c.dockFondo, borderColor: c.linea }, sombra]}
      >
        {resto.slice(0, mitad).map((d) => (
          <Tocable key={d.clave} destino={d}>
            <Rotulado destino={d} />
          </Tocable>
        ))}
        {central && (
          <Tocable destino={central}>
            <View style={e.huecoCentral}>
              <Rotulo destino={central} />
            </View>
          </Tocable>
        )}
        {resto.slice(mitad).map((d) => (
          <Tocable key={d.clave} destino={d}>
            <Rotulado destino={d} />
          </Tocable>
        ))}
      </BlurView>

      {central && (
        <View pointerEvents="box-none" style={e.capaCentral}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={central.activo ? { selected: true } : {}}
            accessibilityLabel={central.rotulo}
            onPress={central.ir}
            style={[
              e.botonCentral,
              // El anillo del color de fondo lo despega de la barra de vidrio.
              { backgroundColor: c.marca, borderColor: c.fondo },
              sombra,
            ]}
          >
            {central.icono(c.sobreMarca, dock.icono + 4)}
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Tocable({ destino, children }: { destino: Destino; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={destino.activo ? { selected: true } : {}}
      accessibilityLabel={destino.rotulo}
      onPress={destino.ir}
      style={e.destino}
    >
      {children}
    </Pressable>
  );
}

/** Icono con su nombre debajo; el activo va en el rojo de marca. */
function Rotulado({ destino }: { destino: Destino }) {
  const { c } = useTema();
  return (
    <View style={e.rotulado}>
      {destino.icono(destino.activo ? c.dockActivo : c.dockInactivo, dock.icono)}
      <Rotulo destino={destino} />
    </View>
  );
}

function Rotulo({ destino }: { destino: Destino }) {
  const { c } = useTema();
  return (
    <Text
      numberOfLines={1}
      style={[
        e.rotulo,
        { color: destino.activo ? c.dockActivo : c.dockInactivo },
        destino.activo && e.rotuloActivo,
      ]}
    >
      {destino.rotulo}
    </Text>
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
    paddingHorizontal: dock.rellenoHorizontal,
    paddingVertical: dock.rellenoVertical,
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
  rotulado: {
    alignSelf: 'stretch',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  rotulo: { fontSize: 11, fontWeight: '600', letterSpacing: -0.1 },
  rotuloActivo: { fontWeight: '800' },
  huecoCentral: {
    alignSelf: 'stretch',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    // Alinea «Vender» con los rotulos vecinos: (60 - (24 + 3 + 14)) / 2.
    paddingBottom: 9.5,
  },
  capaCentral: {
    position: 'absolute',
    top: dock.margenSuperior,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  botonCentral: {
    width: dock.central,
    height: dock.central,
    borderRadius: forma.pildora,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
