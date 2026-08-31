/** Ordenes de trabajo: lo que esta en el taller ahora mismo. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { FAB, Text } from 'react-native-paper';

import { useOrdenes } from '../../src/api/hooks';
import type { EstadoOrden } from '../../src/api/tipos';
import { dinero, fechaCorta } from '../../src/lib/formato';
import {
  AvisoError,
  Cargando,
  Etiqueta,
  Fila,
  Opciones,
  Pantalla,
  Tarjeta,
  Vacio,
} from '../../src/ui/componentes';

const TONOS: Record<EstadoOrden, 'info' | 'alerta' | 'ok' | 'gris' | 'mal'> = {
  abierta: 'info',
  en_proceso: 'alerta',
  terminada: 'ok',
  facturada: 'gris',
  anulada: 'mal',
};

export default function Ordenes() {
  const [filtro, setFiltro] = useState<'abiertas' | 'todas'>('abiertas');
  const {
    data = [],
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useOrdenes(filtro === 'abiertas' ? 'abiertas' : undefined);
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <Pantalla cargando={isRefetching} onRefrescar={refetch}>
        <Opciones
          valor={filtro}
          onCambio={setFiltro}
          opciones={[
            { valor: 'abiertas', texto: 'En el taller' },
            { valor: 'todas', texto: 'Todas' },
          ]}
        />

        {error ? (
          <AvisoError mensaje={(error as Error).message} onReintentar={refetch} />
        ) : isLoading ? (
          <Cargando />
        ) : (
          <Tarjeta titulo={`${data.length} ordenes`}>
            {data.length === 0 ? (
              <Vacio
                titulo="Sin ordenes"
                texto="Cree una orden cuando reciba una moto para reparar."
              />
            ) : (
              data.map((o) => (
                <Fila
                  key={o.id}
                  titulo={`${o.numero ?? ''} · ${o.cliente_nombre ?? 'Ocasional'}`}
                  subtitulo={
                    [o.placa, o.marca, o.linea_moto].filter(Boolean).join(' · ') || 'Sin moto'
                  }
                  detalle={`${fechaCorta(o.fecha)}${o.mecanico ? ` · ${o.mecanico}` : ''}`}
                  onPress={() => router.push(`/orden/${o.id}`)}
                  derecha={
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Etiqueta texto={o.estado.replace('_', ' ')} tono={TONOS[o.estado]} />
                      <Text style={{ fontWeight: '700' }}>{dinero(o.total)}</Text>
                    </View>
                  }
                />
              ))
            )}
          </Tarjeta>
        )}
      </Pantalla>

      <FAB
        icon="plus"
        label="Nueva orden"
        onPress={() => router.push('/orden/nueva')}
        style={{ position: 'absolute', right: 16, bottom: 20 }}
      />
    </View>
  );
}
