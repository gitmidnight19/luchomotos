/** Listado de facturas emitidas. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useVentas } from '../../src/api/hooks';
import { dinero, dineroCorto, fechaCorta } from '../../src/lib/formato';
import {
  AvisoError,
  Cargando,
  Etiqueta,
  Fila,
  Kpi,
  Opciones,
  Pantalla,
  Rejilla,
  Tarjeta,
  Vacio,
} from '../../src/ui/componentes';
import { usePeriodo } from '../../src/ui/periodo';

export default function Ventas() {
  const { desde, hasta, control } = usePeriodo('mes');
  const [soloPendientes, setSoloPendientes] = useState<'todas' | 'pendientes'>('todas');
  const {
    data = [],
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useVentas(desde, hasta, soloPendientes === 'pendientes');
  const router = useRouter();

  const activas = data.filter((v) => v.estado === 'activa');
  const total = activas.reduce((s, v) => s + v.total, 0);
  const costo = activas.reduce((s, v) => s + v.costo_total, 0);

  return (
    <Pantalla cargando={isRefetching} onRefrescar={refetch}>
      {control}
      <Opciones
        valor={soloPendientes}
        onCambio={setSoloPendientes}
        opciones={[
          { valor: 'todas', texto: 'Todas' },
          { valor: 'pendientes', texto: 'Con saldo' },
        ]}
      />

      <Rejilla>
        <Kpi etiqueta="Facturas" valor={String(activas.length)} />
        <Kpi etiqueta="Facturado" valor={dineroCorto(total)} tono="marca" />
        <Kpi etiqueta="Costo repuestos" valor={dineroCorto(costo)} />
        <Kpi etiqueta="Margen bruto" valor={dineroCorto(total - costo)} tono="ok" />
      </Rejilla>

      {error ? (
        <AvisoError mensaje={(error as Error).message} onReintentar={refetch} />
      ) : isLoading ? (
        <Cargando />
      ) : (
        <Tarjeta titulo="Facturas del periodo">
          {data.length === 0 ? (
            <Vacio titulo="Sin ventas" texto="No hay facturas en el periodo elegido." />
          ) : (
            data.map((v) => (
              <Fila
                key={v.id}
                titulo={`${v.numero ?? ''} · ${v.cliente_nombre ?? 'Ocasional'}`}
                subtitulo={fechaCorta(v.fecha)}
                onPress={() => router.push(`/ventas/${v.id}`)}
                derecha={
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text
                      style={{
                        fontWeight: '700',
                        textDecorationLine: v.estado === 'anulada' ? 'line-through' : 'none',
                      }}
                    >
                      {dinero(v.total)}
                    </Text>
                    {v.estado === 'anulada' ? (
                      <Etiqueta texto="anulada" tono="mal" />
                    ) : v.saldo > 0 ? (
                      <Etiqueta texto={`debe ${dineroCorto(v.saldo)}`} tono="alerta" />
                    ) : (
                      <Etiqueta texto="pagada" tono="ok" />
                    )}
                  </View>
                }
              />
            ))
          )}
        </Tarjeta>
      )}
    </Pantalla>
  );
}
