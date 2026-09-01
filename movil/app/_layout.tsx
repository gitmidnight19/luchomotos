/** Raiz de la app: proveedores, tema y navegacion. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { cargarServidor } from '../src/api/cliente';
import { Puntos } from '../src/ui/esqueleto';
import { Sello } from '../src/ui/marca';
import { ProveedorTema, useTema } from '../src/ui/temaProveedor';

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
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={clienteQuery}>
        <ProveedorTema>
          <Navegacion />
        </ProveedorTema>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Navegacion() {
  const { c } = useTema();
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

  if (!listo) return <Splash />;

  return (
    <Stack
      screenOptions={{
        // Sin barra superior (DESIGN/20-mobile.md §3): el titulo lo pone cada
        // pantalla en su lienzo y el volver flota sobre el contenido. Una barra
        // con titulo en cada pantalla roba el alto que necesita el dato.
        headerShown: false,
        contentStyle: { backgroundColor: c.fondo },
        animation: 'slide_from_right',
      }}
    />
  );
}

/** Splash corto: el unico sitio, junto al porton de conexion, donde van puntos. */
function Splash() {
  const { c } = useTema();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        backgroundColor: c.fondo,
      }}
    >
      <Sello />
      <Puntos />
    </View>
  );
}
