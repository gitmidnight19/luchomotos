/** Flujo de caja: entradas y salidas de dinero del periodo. */
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useFlujo, useImpuestos } from '../../src/api/hooks';
import { dinero, dineroCorto, fechaCorta } from '../../src/lib/formato';
import {
  AvisoError,
  Cargando,
  Fila,
  Kpi,
  Pantalla,
  Rejilla,
  Tarjeta,
  Vacio,
} from '../../src/ui/componentes';
import { usePeriodo } from '../../src/ui/periodo';
import { colores } from '../../src/ui/tema';

export default function Flujo() {
  const { desde, hasta, control } = usePeriodo('mes');
  const { data, isLoading, isRefetching, error, refetch } = useFlujo(desde, hasta);
  const { data: impuestos } = useImpuestos(desde, hasta);

  if (error) return <AvisoError mensaje={(error as Error).message} onReintentar={refetch} />;
  if (isLoading || !data) return <Cargando />;

  return (
    <Pantalla cargando={isRefetching} onRefrescar={refetch}>
      {control}

      <Rejilla>
        <Kpi etiqueta="Saldo inicial" valor={dineroCorto(data.saldo_inicial)} />
        <Kpi etiqueta="Saldo final" valor={dineroCorto(data.saldo_final)} tono="marca" />
        <Kpi etiqueta="Entradas" valor={dineroCorto(data.total_entradas)} tono="ok" />
        <Kpi etiqueta="Salidas" valor={dineroCorto(data.total_salidas)} tono="mal" />
      </Rejilla>

      {!!impuestos && (
        <Tarjeta titulo="IVA del periodo">
          <Fila titulo="IVA generado en ventas" valor={dinero(impuestos.iva_generado)} />
          <Fila titulo="IVA descontable de compras" valor={dinero(impuestos.iva_descontable)} />
          <Fila
            titulo={impuestos.saldo_a_pagar >= 0 ? 'Saldo a pagar' : 'Saldo a favor'}
            valor={dinero(Math.abs(impuestos.saldo_a_pagar))}
            tonoValor={impuestos.saldo_a_pagar >= 0 ? 'mal' : 'ok'}
          />
          <View style={{ padding: 14 }}>
            <Text style={{ color: colores.suave, fontSize: 12.5 }}>
              Calculo informativo. Verifique el calendario tributario que le aplique antes de
              declarar.
            </Text>
          </View>
        </Tarjeta>
      )}

      <Tarjeta titulo="Movimientos de caja y bancos">
        {data.movimientos.length === 0 ? (
          <Vacio titulo="Sin movimientos" texto="No hubo entradas ni salidas de dinero." />
        ) : (
          data.movimientos.map((m, i) => (
            <Fila
              key={`${m.fecha}-${i}`}
              titulo={m.descripcion ?? m.doc_tipo}
              subtitulo={`${m.doc_tipo} · ${fechaCorta(m.fecha)}`}
              derecha={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontWeight: '700',
                      color: m.entra > 0 ? colores.ok : colores.error,
                    }}
                  >
                    {m.entra > 0 ? `+${dinero(m.entra)}` : `-${dinero(m.sale)}`}
                  </Text>
                  <Text style={{ fontSize: 12, color: colores.suave }}>
                    saldo {dinero(m.saldo)}
                  </Text>
                </View>
              }
            />
          ))
        )}
      </Tarjeta>
    </Pantalla>
  );
}
