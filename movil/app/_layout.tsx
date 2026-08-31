/** Raiz de la app: proveedores, tema y navegacion. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, PaperProvider, Text } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { cargarServidor } from '../src/api/cliente';
import { colores, tema } from '../src/ui/tema';

const clienteQuery = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function Raiz() {
  const [listo, setListo] = useState(false);
  const [hayServidor, setHayServidor] = useState(false);
  const router = useRouter();

  useEffect(() => {
    cargarServidor()
      .then((url) => setHayServidor(!!url))
      .finally(() => setListo(true));
  }, []);

  useEffect(() => {
    if (listo && !hayServidor) router.replace('/conexion');
  }, [listo, hayServidor, router]);

  if (!listo) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colores.fondo,
        }}
      >
        <MaterialCommunityIcons name="motorbike" size={44} color={colores.marca} />
        <Text variant="titleMedium" style={{ marginTop: 12 }}>
          Taller Contable
        </Text>
        <ActivityIndicator style={{ marginTop: 16 }} color={colores.marca} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={clienteQuery}>
        <PaperProvider theme={tema}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colores.marca },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700', fontSize: 17 },
              contentStyle: { backgroundColor: colores.fondo },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="conexion" options={{ title: 'Conectar con el taller' }} />
            <Stack.Screen name="ventas/index" options={{ title: 'Ventas' }} />
            <Stack.Screen name="ventas/[id]" options={{ title: 'Factura' }} />
            <Stack.Screen name="orden/[id]" options={{ title: 'Orden de trabajo' }} />
            <Stack.Screen name="compras/index" options={{ title: 'Compras' }} />
            <Stack.Screen name="compras/nueva" options={{ title: 'Registrar compra' }} />
            <Stack.Screen name="producto/[id]" options={{ title: 'Repuesto' }} />
            <Stack.Screen name="gastos" options={{ title: 'Gastos' }} />
            <Stack.Screen name="cartera" options={{ title: 'Cobros y pagos' }} />
            <Stack.Screen name="clientes" options={{ title: 'Clientes y proveedores' }} />
            <Stack.Screen name="motos" options={{ title: 'Motos' }} />
            <Stack.Screen name="servicios" options={{ title: 'Servicios' }} />
            <Stack.Screen name="informes/resultados" options={{ title: 'Estado de resultados' }} />
            <Stack.Screen name="informes/balance" options={{ title: 'Balance general' }} />
            <Stack.Screen name="informes/diario" options={{ title: 'Libro diario' }} />
            <Stack.Screen name="informes/flujo" options={{ title: 'Flujo de caja' }} />
            <Stack.Screen name="config" options={{ title: 'Configuracion' }} />
          </Stack>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
