/** Inventario: existencias, valor y alertas de reposicion. */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Searchbar, Text } from 'react-native-paper';

import { useInventario } from '../../src/api/hooks';
import { cantidad, dinero, dineroCorto, porcentaje } from '../../src/lib/formato';
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
import { useTema } from '../../src/ui/temaProveedor';

export default function Inventario() {
  const { c } = useTema();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'reponer'>('todos');
  const { data, isLoading, isRefetching, error, refetch } = useInventario();
  const router = useRouter();

  const items = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (data?.items ?? []).filter((p) => {
      const coincide =
        !texto ||
        `${p.nombre} ${p.sku ?? ''} ${p.categoria_nombre ?? ''}`.toLowerCase().includes(texto);
      const reponer = filtro === 'todos' || p.stock <= p.stock_min;
      return coincide && reponer;
    });
  }, [data, busqueda, filtro]);

  if (error)
    return (
      <Pantalla dock>
        <AvisoError mensaje={(error as Error).message} onReintentar={refetch} />
      </Pantalla>
    );
  if (isLoading || !data)
    return (
      <Pantalla dock>
        <Cargando />
      </Pantalla>
    );

  const porReponer = data.items.filter((p) => p.stock <= p.stock_min).length;

  return (
    <Pantalla
      dock
      cargando={isRefetching}
      onRefrescar={refetch}
      accion={{ rotulo: 'Repuesto', onPress: () => router.push('/producto/nuevo') }}
    >
      <Rejilla>
        <Kpi etiqueta="Valor al costo" valor={dineroCorto(data.total_costo)} tono="marca" />
        <Kpi
          etiqueta="Valor de venta"
          valor={dineroCorto(data.total_venta)}
          nota={`${data.items.length} referencias`}
        />
        <Kpi etiqueta="Unidades" valor={cantidad(data.unidades)} />
        <Kpi
          etiqueta="Por reponer"
          valor={String(porReponer)}
          tono={porReponer ? 'mal' : 'ok'}
          nota="Bajo el minimo"
        />
      </Rejilla>

      <Searchbar
        placeholder="Buscar repuesto…"
        value={busqueda}
        onChangeText={setBusqueda}
        style={{ marginBottom: 12, backgroundColor: c.superficie, borderRadius: 12 }}
      />
      <Opciones
        valor={filtro}
        onCambio={setFiltro}
        opciones={[
          { valor: 'todos', texto: 'Todos' },
          { valor: 'reponer', texto: `Por reponer (${porReponer})` },
        ]}
      />

      <Tarjeta titulo={`${items.length} repuestos`}>
        {items.length === 0 ? (
          <Vacio titulo="Sin resultados" texto="Cree repuestos o registre una compra." />
        ) : (
          items.map((p) => (
            <Fila
              key={p.id}
              titulo={p.nombre}
              subtitulo={`${p.sku ?? ''}${p.categoria_nombre ? ` · ${p.categoria_nombre}` : ''}`}
              detalle={`Costo ${dinero(p.costo_promedio)} · margen ${porcentaje(p.margen)}`}
              onPress={() => router.push(`/producto/${p.id}`)}
              derecha={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontWeight: '800', fontSize: 16 }}>{cantidad(p.stock)}</Text>
                  <Text style={{ fontSize: 12 }}>{dinero(p.precio_venta)}</Text>
                  {p.stock <= p.stock_min && <Etiqueta texto="reponer" tono="alerta" />}
                </View>
              }
            />
          ))
        )}
      </Tarjeta>
    </Pantalla>
  );
}
