/** Barra inferior con lo que se usa a diario en el taller. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { colores } from '../../src/ui/tema';

type Icono = keyof typeof MaterialCommunityIcons.glyphMap;

function icono(nombre: Icono) {
  const Icono = ({ color, size }: { color: ColorValue; size: number }) => (
    <MaterialCommunityIcons name={nombre} color={color as string} size={size} />
  );
  Icono.displayName = `Icono(${nombre})`;
  return Icono;
}

export default function Pestanas() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colores.marca },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        tabBarActiveTintColor: colores.marca,
        tabBarInactiveTintColor: colores.suave,
        tabBarStyle: { borderTopColor: colores.linea, height: 60, paddingBottom: 6, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '600' },
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
