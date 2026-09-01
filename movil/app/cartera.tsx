/** Cartera: quien nos debe, a quien le debemos y traslados de dinero. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { useCartera, usePagos, useRegistrarPago, useTraslado } from '../src/api/hooks';
import type { MetodoPago } from '../src/api/tipos';
import {
  aCentavos,
  dinero,
  dineroCorto,
  enPesos,
  fechaCorta,
  hoy,
  primerDiaMes,
} from '../src/lib/formato';
import {
  Boton,
  CampoNumero,
  CampoTexto,
  Cargando,
  Etiqueta,
  Fila,
  Kpi,
  Opciones,
  Pantalla,
  Rejilla,
  Tarjeta,
  Vacio,
} from '../src/ui/componentes';
import { useTema } from '../src/ui/temaProveedor';

export default function Cartera() {
  const { c } = useTema();
  const { data, isLoading, isRefetching, refetch } = useCartera();
  const { data: pagos = [] } = usePagos(primerDiaMes(), hoy());
  const registrar = useRegistrarPago();
  const traslado = useTraslado();
  const router = useRouter();

  const [cobro, setCobro] = useState<{ id: number; saldo: number; clase: 'cobro' | 'pago' } | null>(
    null,
  );
  const [monto, setMonto] = useState('0');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');

  const [dialogoTraslado, setDialogoTraslado] = useState(false);
  const [montoTraslado, setMontoTraslado] = useState('');
  const [origen, setOrigen] = useState<MetodoPago>('efectivo');
  const [nota, setNota] = useState('Consignacion del recaudo');

  if (isLoading || !data)
    return (
      <Pantalla titulo="Cobros y pagos" atras>
        <Cargando />
      </Pantalla>
    );

  async function guardarPago() {
    const actual = cobro;
    setCobro(null);
    if (!actual) return;
    try {
      await registrar.mutateAsync({
        clase: actual.clase,
        doc_id: actual.id,
        monto: aCentavos(monto),
        metodo,
      });
      Alert.alert(actual.clase === 'cobro' ? 'Abono registrado' : 'Pago registrado');
    } catch (e) {
      Alert.alert('No se pudo registrar', (e as Error).message);
    }
  }

  async function guardarTraslado() {
    setDialogoTraslado(false);
    try {
      await traslado.mutateAsync({
        monto: aCentavos(montoTraslado),
        origen,
        destino: origen === 'efectivo' ? 'banco' : 'efectivo',
        nota,
      });
      setMontoTraslado('');
      Alert.alert('Traslado registrado');
    } catch (e) {
      Alert.alert('No se pudo registrar', (e as Error).message);
    }
  }

  return (
    <Pantalla
      titulo="Cobros y pagos"
      subtitulo="Cartera de clientes y deuda con proveedores"
      atras
      cargando={isRefetching}
      onRefrescar={refetch}
    >
      <Rejilla>
        <Kpi
          etiqueta="Por cobrar"
          valor={dineroCorto(data.total_cobrar)}
          nota={`${data.por_cobrar.length} facturas`}
          tono="ok"
        />
        <Kpi
          etiqueta="Por pagar"
          valor={dineroCorto(data.total_pagar)}
          nota={`${data.por_pagar.length} compras`}
          tono="mal"
        />
      </Rejilla>

      <Boton
        titulo="Traslado entre caja y banco"
        tono="suave"
        onPress={() => setDialogoTraslado(true)}
        style={{ marginBottom: 12 }}
      />

      <Tarjeta titulo="Clientes que nos deben">
        {data.por_cobrar.length === 0 ? (
          <Vacio titulo="Cartera al dia" texto="Ninguna factura pendiente de cobro." />
        ) : (
          data.por_cobrar.map((f) => (
            <Fila
              key={f.id}
              titulo={f.tercero ?? 'Cliente ocasional'}
              subtitulo={`${f.numero ?? ''} · ${fechaCorta(f.fecha)}`}
              detalle={f.telefono ?? undefined}
              onPress={() => {
                setMonto(String(enPesos(f.saldo)));
                setMetodo('efectivo');
                setCobro({ id: f.id, saldo: f.saldo, clase: 'cobro' });
              }}
              derecha={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontWeight: '700' }}>{dinero(f.saldo)}</Text>
                  <Etiqueta
                    texto={`${f.dias} dias`}
                    tono={f.dias > 30 ? 'mal' : f.dias > 15 ? 'alerta' : 'gris'}
                  />
                </View>
              }
            />
          ))
        )}
      </Tarjeta>

      <Tarjeta titulo="Le debemos a proveedores">
        {data.por_pagar.length === 0 ? (
          <Vacio titulo="Sin deudas" texto="No hay compras pendientes de pago." />
        ) : (
          data.por_pagar.map((f) => (
            <Fila
              key={f.id}
              titulo={f.tercero ?? 'Proveedor'}
              subtitulo={`${f.numero ?? ''} · ${fechaCorta(f.fecha)}`}
              onPress={() => {
                setMonto(String(enPesos(f.saldo)));
                setMetodo('banco');
                setCobro({ id: f.id, saldo: f.saldo, clase: 'pago' });
              }}
              derecha={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontWeight: '700' }}>{dinero(f.saldo)}</Text>
                  <Etiqueta texto={`${f.dias} dias`} tono="gris" />
                </View>
              }
            />
          ))
        )}
      </Tarjeta>

      <Tarjeta titulo="Movimientos del mes">
        {pagos.length === 0 ? (
          <Vacio titulo="Sin movimientos" />
        ) : (
          pagos.map((p) => (
            <Fila
              key={p.id}
              titulo={p.tercero_nombre ?? (p.clase === 'cobro' ? 'Cobro' : 'Pago')}
              subtitulo={`${p.doc_tipo ?? ''} ${p.doc_id ?? ''} · ${p.metodo}`}
              detalle={fechaCorta(p.fecha)}
              valor={dinero(p.monto)}
              tonoValor={p.clase === 'cobro' ? 'ok' : 'mal'}
            />
          ))
        )}
      </Tarjeta>

      <Portal>
        <Dialog
          visible={!!cobro}
          onDismiss={() => setCobro(null)}
          style={{ backgroundColor: c.superficie }}
        >
          <Dialog.Title>
            {cobro?.clase === 'cobro' ? 'Registrar abono' : 'Pagar al proveedor'}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: c.suave, marginBottom: 10 }}>
              Saldo pendiente: {dinero(cobro?.saldo ?? 0)}
            </Text>
            <CampoNumero label="Monto" value={monto} onChangeText={setMonto} />
            <Opciones
              etiqueta={cobro?.clase === 'cobro' ? 'Recibe en' : 'Paga con'}
              valor={metodo}
              onCambio={setMetodo}
              opciones={[
                { valor: 'efectivo', texto: 'Efectivo' },
                { valor: 'banco', texto: 'Transferencia' },
              ]}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCobro(null)}>Cancelar</Button>
            <Button onPress={guardarPago} loading={registrar.isPending}>
              Registrar
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={dialogoTraslado}
          onDismiss={() => setDialogoTraslado(false)}
          style={{ backgroundColor: c.superficie }}
        >
          <Dialog.Title>Traslado de fondos</Dialog.Title>
          <Dialog.Content>
            <Opciones
              etiqueta="Sale de"
              valor={origen}
              onCambio={setOrigen}
              opciones={[
                { valor: 'efectivo', texto: 'Caja → Banco' },
                { valor: 'banco', texto: 'Banco → Caja' },
              ]}
            />
            <CampoNumero label="Monto" value={montoTraslado} onChangeText={setMontoTraslado} />
            <CampoTexto label="Concepto" value={nota} onChangeText={setNota} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogoTraslado(false)}>Cancelar</Button>
            <Button onPress={guardarTraslado} loading={traslado.isPending}>
              Registrar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Boton
        titulo="Ver flujo de caja"
        tono="suave"
        onPress={() => router.push('/informes/flujo')}
      />
    </Pantalla>
  );
}
