/** Libro diario: los asientos que el sistema genero automaticamente. */
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useDiario } from '../../src/api/hooks';
import { dinero, fechaCorta } from '../../src/lib/formato';
import { AvisoError, Cargando, Etiqueta, Pantalla, Tarjeta, Vacio } from '../../src/ui/componentes';
import { usePeriodo } from '../../src/ui/periodo';
import { colores } from '../../src/ui/tema';

export default function Diario() {
  const { desde, hasta, control } = usePeriodo('mes');
  const { data = [], isLoading, isRefetching, error, refetch } = useDiario(desde, hasta);

  if (error) return <AvisoError mensaje={(error as Error).message} onReintentar={refetch} />;
  if (isLoading) return <Cargando />;

  return (
    <Pantalla cargando={isRefetching} onRefrescar={refetch}>
      {control}

      <Text style={{ color: colores.suave, marginBottom: 10 }}>
        {data.length} asientos. Todos se generaron solos a partir de las ventas, compras, gastos y
        pagos.
      </Text>

      {data.length === 0 ? (
        <Tarjeta>
          <Vacio titulo="Sin asientos" texto="No hay movimientos contables en el periodo." />
        </Tarjeta>
      ) : (
        [...data].reverse().map((a) => (
          <Tarjeta key={a.id}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: colores.linea,
                gap: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }} numberOfLines={2}>
                  {a.descripcion ?? a.doc_tipo}
                </Text>
                <Text style={{ color: colores.suave, fontSize: 12.5 }}>
                  #{a.id} · {fechaCorta(a.fecha)}
                </Text>
              </View>
              <Etiqueta texto={a.doc_tipo} tono={a.anulado ? 'mal' : 'info'} />
            </View>

            {a.lineas.map((l, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  gap: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5 }} numberOfLines={1}>
                    {l.codigo} · {l.nombre}
                  </Text>
                  {!!l.detalle && (
                    <Text style={{ fontSize: 11.5, color: colores.suave }} numberOfLines={1}>
                      {l.detalle}
                    </Text>
                  )}
                </View>
                <Text style={{ width: 92, textAlign: 'right', fontSize: 13 }}>
                  {l.debe ? dinero(l.debe) : ''}
                </Text>
                <Text style={{ width: 92, textAlign: 'right', fontSize: 13 }}>
                  {l.haber ? dinero(l.haber) : ''}
                </Text>
              </View>
            ))}

            <View
              style={{
                flexDirection: 'row',
                padding: 12,
                backgroundColor: '#fafbfd',
                borderTopWidth: 1,
                borderTopColor: colores.linea,
              }}
            >
              <Text style={{ flex: 1, fontWeight: '700', fontSize: 12.5 }}>Sumas iguales</Text>
              <Text style={{ width: 92, textAlign: 'right', fontWeight: '700', fontSize: 12.5 }}>
                {dinero(a.total)}
              </Text>
              <Text style={{ width: 92, textAlign: 'right', fontWeight: '700', fontSize: 12.5 }}>
                {dinero(a.total)}
              </Text>
            </View>
          </Tarjeta>
        ))
      )}
    </Pantalla>
  );
}
