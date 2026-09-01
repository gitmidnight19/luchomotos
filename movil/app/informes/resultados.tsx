/** Estado de resultados: en que se gana y en que se va la plata. */
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useResultados } from '../../src/api/hooks';
import { dinero, dineroCorto, fechaCorta, porcentaje } from '../../src/lib/formato';
import {
  AvisoError,
  Cargando,
  Fila,
  Kpi,
  Pantalla,
  Rejilla,
  Tarjeta,
} from '../../src/ui/componentes';
import { usePeriodo } from '../../src/ui/periodo';
import { useTema } from '../../src/ui/temaProveedor';

export default function Resultados() {
  const { c } = useTema();
  const { desde, hasta, control } = usePeriodo('mes');
  const { data, isLoading, isRefetching, error, refetch } = useResultados(desde, hasta);

  if (error)
    return (
      <Pantalla titulo="Estado de resultados" atras>
        <AvisoError mensaje={(error as Error).message} onReintentar={refetch} />
      </Pantalla>
    );
  if (isLoading || !data)
    return (
      <Pantalla titulo="Estado de resultados" atras>
        <Cargando preset="informe" />
      </Pantalla>
    );

  const bloque = (titulo: string, filas: typeof data.ingresos, total: number, signo?: string) => (
    <Tarjeta titulo={titulo}>
      {filas.length === 0 ? (
        <View style={{ padding: 14 }}>
          <Text style={{ color: c.suave }}>Sin movimientos en el periodo</Text>
        </View>
      ) : (
        filas.map((f) => (
          <Fila key={f.codigo} titulo={f.nombre} subtitulo={f.codigo} valor={dinero(f.saldo)} />
        ))
      )}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          padding: 14,
          backgroundColor: c.campo,
        }}
      >
        <Text style={{ fontWeight: '700' }}>
          {signo ? `${signo} ` : ''}Total {titulo.toLowerCase()}
        </Text>
        <Text style={{ fontWeight: '700' }}>{dinero(total)}</Text>
      </View>
    </Tarjeta>
  );

  const resultado = (titulo: string, valor: number) => (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: c.marcaSuave,
        borderRadius: 12,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontWeight: '800', fontSize: 15 }}>{titulo}</Text>
      <Text
        style={{
          fontWeight: '800',
          fontSize: 15,
          color: valor >= 0 ? c.bien : c.peligro,
        }}
      >
        {dinero(valor)}
      </Text>
    </View>
  );

  return (
    <Pantalla
      titulo="Estado de resultados"
      subtitulo="Ingresos, costos y utilidad"
      atras
      cargando={isRefetching}
      onRefrescar={refetch}
    >
      {control}

      <Rejilla>
        <Kpi etiqueta="Ingresos" valor={dineroCorto(data.total_ingresos)} tono="marca" />
        <Kpi etiqueta="Costo de ventas" valor={dineroCorto(data.total_costos)} />
        <Kpi etiqueta="Gastos" valor={dineroCorto(data.total_gastos)} />
        <Kpi
          etiqueta="Utilidad neta"
          valor={dineroCorto(data.utilidad_neta)}
          nota={`Margen ${porcentaje(data.margen_neto)}`}
          tono={data.utilidad_neta >= 0 ? 'ok' : 'mal'}
        />
      </Rejilla>

      <Text style={{ color: c.suave, marginBottom: 10 }}>
        Del {fechaCorta(data.desde)} al {fechaCorta(data.hasta)}
      </Text>

      {bloque('Ingresos operacionales', data.ingresos, data.total_ingresos)}
      {bloque('Costo de ventas', data.costos, data.total_costos, '(-)')}
      {resultado('= UTILIDAD BRUTA', data.utilidad_bruta)}
      {bloque('Gastos de administracion', data.gastos, data.total_gastos, '(-)')}
      {resultado('= UTILIDAD NETA', data.utilidad_neta)}

      <Tarjeta titulo="Indicadores">
        <Fila titulo="Margen bruto" valor={porcentaje(data.margen_bruto)} />
        <Fila titulo="Margen neto" valor={porcentaje(data.margen_neto)} />
        <Fila
          titulo="Gastos sobre ventas"
          valor={porcentaje(
            data.total_ingresos ? (data.total_gastos / data.total_ingresos) * 100 : 0,
          )}
        />
      </Tarjeta>
    </Pantalla>
  );
}
