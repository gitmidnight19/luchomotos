/** Balance general a la fecha de corte. */
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useBalance } from '../../src/api/hooks';
import { dinero, dineroCorto, fechaLarga, hoy } from '../../src/lib/formato';
import {
  AvisoError,
  Cargando,
  Etiqueta,
  Fila,
  Kpi,
  Pantalla,
  Rejilla,
  Tarjeta,
} from '../../src/ui/componentes';
import { useTema } from '../../src/ui/temaProveedor';

export default function Balance() {
  const { c } = useTema();
  const { data, isLoading, isRefetching, error, refetch } = useBalance(hoy());

  if (error)
    return (
      <Pantalla titulo="Balance general" atras>
        <AvisoError mensaje={(error as Error).message} onReintentar={refetch} />
      </Pantalla>
    );
  if (isLoading || !data)
    return (
      <Pantalla titulo="Balance general" atras>
        <Cargando preset="informe" />
      </Pantalla>
    );

  const grupo = (
    titulo: string,
    filas: typeof data.activos,
    total: number,
    extra?: { nombre: string; valor: number },
  ) => (
    <Tarjeta titulo={titulo}>
      {filas.map((f) => (
        <Fila key={f.codigo} titulo={f.nombre} subtitulo={f.codigo} valor={dinero(f.saldo)} />
      ))}
      {!!extra && <Fila titulo={extra.nombre} valor={dinero(extra.valor)} tonoValor="ok" />}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          padding: 14,
          backgroundColor: c.campo,
        }}
      >
        <Text style={{ fontWeight: '700' }}>TOTAL</Text>
        <Text style={{ fontWeight: '700' }}>{dinero(total)}</Text>
      </View>
    </Tarjeta>
  );

  const cuadra = Math.abs(data.diferencia) < 0.05;

  return (
    <Pantalla
      titulo="Balance general"
      subtitulo="Activos, pasivos y patrimonio"
      atras
      cargando={isRefetching}
      onRefrescar={refetch}
    >
      <Text style={{ color: c.suave, marginBottom: 10 }}>Corte al {fechaLarga(data.hasta)}</Text>

      <Rejilla>
        <Kpi etiqueta="Activos" valor={dineroCorto(data.total_activos)} tono="marca" />
        <Kpi etiqueta="Pasivos" valor={dineroCorto(data.total_pasivos)} />
        <Kpi
          etiqueta="Patrimonio"
          valor={dineroCorto(data.total_patrimonio)}
          tono="ok"
          ancho="100%"
        />
      </Rejilla>

      {grupo('Activos', data.activos, data.total_activos)}
      {grupo('Pasivos', data.pasivos, data.total_pasivos)}
      {grupo('Patrimonio', data.patrimonio, data.total_patrimonio, {
        nombre: 'Utilidad del ejercicio',
        valor: data.utilidad_ejercicio,
      })}

      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Etiqueta
          texto={
            cuadra ? 'Activo = Pasivo + Patrimonio ✓' : `Descuadre de ${dinero(data.diferencia)}`
          }
          tono={cuadra ? 'ok' : 'mal'}
        />
      </View>
    </Pantalla>
  );
}
