/** Panel: como va el taller hoy, este mes y que necesita atencion. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useConfig, useDashboard } from '../../src/api/hooks';
import {
  configurarFormato,
  dinero,
  dineroCorto,
  fechaCorta,
  porcentaje,
} from '../../src/lib/formato';
import {
  AvisoError,
  Cargando,
  Etiqueta,
  Fila,
  Kpi,
  Pantalla,
  Rejilla,
  Seccion,
  Tarjeta,
  Vacio,
} from '../../src/ui/componentes';
import { useTema } from '../../src/ui/temaProveedor';

export default function Panel() {
  const { c } = useTema();
  const { data: config } = useConfig();
  const { data, isLoading, isRefetching, error, refetch } = useDashboard();
  const router = useRouter();

  useEffect(() => {
    if (config) configurarFormato(config.moneda, config.decimales);
  }, [config]);

  if (error)
    return (
      <Pantalla dock>
        <AvisoError mensaje={(error as Error).message} onReintentar={refetch} />
      </Pantalla>
    );
  if (isLoading || !data)
    return (
      <Pantalla dock>
        <Cargando preset="panel" />
      </Pantalla>
    );

  const maximo = Math.max(...data.serie.map((d) => d.ventas), 1);

  return (
    <Pantalla dock cargando={isRefetching} onRefrescar={refetch}>
      <Seccion orden={0}>
        <Rejilla>
          <Kpi
            etiqueta="Ventas del mes"
            valor={dineroCorto(data.ventas_mes)}
            nota={`${data.num_ventas_mes} facturas`}
            tono="marca"
          />
          <Kpi
            etiqueta="Utilidad del mes"
            valor={dineroCorto(data.utilidad_neta_mes)}
            nota={`Margen ${porcentaje(data.margen_mes)}`}
            tono={data.utilidad_neta_mes >= 0 ? 'ok' : 'mal'}
          />
          <Kpi
            etiqueta="Ventas de hoy"
            valor={dineroCorto(data.ventas_hoy)}
            nota={fechaCorta(data.fecha)}
          />
          <Kpi
            etiqueta="Efectivo disponible"
            valor={dineroCorto(data.efectivo_total)}
            nota={`Caja ${dineroCorto(data.caja)} · Banco ${dineroCorto(data.banco)}`}
          />
          <Kpi
            etiqueta="Por cobrar"
            valor={dineroCorto(data.cxc)}
            nota="Cartera de clientes"
            onPress={() => router.push('/cartera')}
          />
          <Kpi
            etiqueta="Por pagar"
            valor={dineroCorto(data.cxp)}
            nota="Deuda con proveedores"
            onPress={() => router.push('/cartera')}
          />
          <Kpi
            etiqueta="Inventario al costo"
            valor={dineroCorto(data.inventario_valor)}
            nota={`Venta ${dineroCorto(data.inventario_venta)}`}
            onPress={() => router.push('/(tabs)/inventario')}
          />
          <Kpi
            etiqueta="Ordenes abiertas"
            valor={String(data.ordenes_abiertas)}
            nota="Trabajos en el taller"
            onPress={() => router.push('/(tabs)/ordenes')}
          />
        </Rejilla>
      </Seccion>

      <Seccion orden={1}>
        <Tarjeta titulo="Ventas de los ultimos 30 dias">
          <View style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 2 }}>
              {data.serie.map((d) => (
                <View key={d.fecha} style={{ flex: 1, alignItems: 'center' }}>
                  <View
                    style={{
                      width: '100%',
                      height: Math.max((d.ventas / maximo) * 100, d.ventas > 0 ? 3 : 1),
                      backgroundColor: d.ventas > 0 ? c.marca : c.linea,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                    }}
                  />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontSize: 11, color: c.suave }}>
                {fechaCorta(data.serie[0]?.fecha)}
              </Text>
              <Text style={{ fontSize: 11, color: c.suave }}>maximo {dineroCorto(maximo)}</Text>
              <Text style={{ fontSize: 11, color: c.suave }}>
                {fechaCorta(data.serie[data.serie.length - 1]?.fecha)}
              </Text>
            </View>
          </View>
        </Tarjeta>
      </Seccion>

      <Seccion orden={2}>
        <Tarjeta
          titulo="Repuestos por reponer"
          accion={
            <Etiqueta
              texto={String(data.num_bajo_stock)}
              tono={data.num_bajo_stock ? 'alerta' : 'ok'}
            />
          }
        >
          {data.bajo_stock.length === 0 ? (
            <Vacio titulo="Todo en orden" texto="Ningun repuesto esta bajo el minimo." />
          ) : (
            data.bajo_stock.map((p) => (
              <Fila
                key={p.id}
                titulo={p.nombre}
                subtitulo={p.sku ?? undefined}
                valor={`${p.stock}`}
                valorSecundario={`min. ${p.stock_min}`}
                tonoValor="alerta"
                onPress={() => router.push(`/producto/${p.id}`)}
              />
            ))
          )}
        </Tarjeta>
      </Seccion>

      <Seccion orden={3}>
        <Tarjeta titulo="Lo mas vendido del mes">
          {data.top_productos.length === 0 && data.top_servicios.length === 0 ? (
            <Vacio titulo="Sin ventas este mes" texto="Registre la primera venta del mes." />
          ) : (
            <>
              {data.top_productos.slice(0, 5).map((p, i) => (
                <Fila
                  key={`p${i}`}
                  titulo={p.nombre ?? 'Repuesto'}
                  subtitulo={`${p.cant} unidades`}
                  valor={dinero(p.monto)}
                />
              ))}
              {data.top_servicios.slice(0, 5).map((s, i) => (
                <Fila
                  key={`s${i}`}
                  titulo={s.nombre ?? 'Servicio'}
                  subtitulo={`${s.cant} servicios`}
                  valor={dinero(s.monto)}
                />
              ))}
            </>
          )}
        </Tarjeta>
      </Seccion>

      <Seccion orden={4}>
        <Tarjeta titulo="Resultado del ejercicio">
          <Fila titulo="Ingresos del año" valor={dinero(data.ingresos_anio)} />
          <Fila titulo="Gastos del mes" valor={dinero(data.gastos_mes)} />
          <Fila
            titulo="Utilidad acumulada del año"
            valor={dinero(data.utilidad_anio)}
            tonoValor={data.utilidad_anio >= 0 ? 'ok' : 'mal'}
          />
          <Fila
            titulo="Ver estado de resultados"
            onPress={() => router.push('/informes/resultados')}
            derecha={<MaterialCommunityIcons name="chevron-right" size={22} color={c.suave} />}
          />
        </Tarjeta>
      </Seccion>
    </Pantalla>
  );
}
