/** Dock flotante con lo que se usa a diario en el taller. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Dock } from '../../src/ui/dock';
import { useTema } from '../../src/ui/temaProveedor';

type Icono = keyof typeof MaterialCommunityIcons.glyphMap;

function icono(nombre: Icono) {
  const Icono = ({ color, size }: { color: ColorValue; size: number }) => (
    <MaterialCommunityIcons name={nombre} color={color as string} size={size} />
  );
  Icono.displayName = `Icono(${nombre})`;
  return Icono;
}

export default function Pestanas() {
  const { c } = useTema();

  return (
    <Tabs
      tabBar={(props) => <Dock {...props} />}
      screenOptions={{
        // Sin barra superior: cada pantalla titula en su lienzo y el dock dice
        // en que seccion se esta (DESIGN/20-mobile.md §3).
        headerShown: false,
        sceneStyle: { backgroundColor: c.fondo },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Panel', tabBarIcon: icono('view-dashboard-outline') }}
      />
      <Tabs.Screen name="venta" options={{ title: 'Vender', tabBarIcon: icono('cart-plus') }} />
      <Tabs.Screen
        name="ordenes"
        options={{ title: 'Ordenes', tabBarIcon: icono('wrench-outline') }}
      />
      <Tabs.Screen
        name="inventario"
        options={{ title: 'Inventario', tabBarIcon: icono('package-variant-closed') }}
      />
      <Tabs.Screen name="mas" options={{ title: 'Mas', tabBarIcon: icono('dots-horizontal') }} />
    </Tabs>
  );
}
