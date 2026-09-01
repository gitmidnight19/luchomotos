/** Compras a proveedores. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { useAnularCompra, useCompra, useCompras, useRegistrarPago } from '../../src/api/hooks';
import type { MetodoPago } from '../../src/api/tipos';
import {
  aCentavos,
  cantidad,
  dinero,
  dineroCorto,
  enPesos,
  fechaCorta,
} from '../../src/lib/formato';
import {
  AvisoError,
  CampoNumero,
  Cargando,
  Etiqueta,
  Fila,
  Opciones,
  Pantalla,
  Tarjeta,
  TotalesCaja,
  Vacio,
} from '../../src/ui/componentes';
import { usePeriodo } from '../../src/ui/periodo';
import { useTema } from '../../src/ui/temaProveedor';

export default function Compras() {
  const { c } = useTema();
  const { desde, hasta, control } = usePeriodo('mes');
  const { data = [], isLoading, isRefetching, error, refetch } = useCompras(desde, hasta);
  const [verId, setVerId] = useState<number | null>(null);
  const [pagarId, setPagarId] = useState<number | null>(null);
  const [monto, setMonto] = useState('0');
  const [metodo, setMetodo] = useState<MetodoPago>('banco');
  const { data: detalle } = useCompra(verId ?? 0);
  const anular = useAnularCompra();
  const pagar = useRegistrarPago();
  const router = useRouter();

  const total = data.filter((c) => c.estado === 'activa').reduce((s, c) => s + c.total, 0);

  async function registrarPago() {
    const id = pagarId;
    setPagarId(null);
    if (!id) return;
    try {
      await pagar.mutateAsync({ clase: 'pago', doc_id: id, monto: aCentavos(monto), metodo });
      Alert.alert('Pago registrado');
    } catch (e) {
      Alert.alert('No se pudo registrar', (e as Error).message);
    }
  }

  function confirmarAnular(id: number) {
    setVerId(null);
    Alert.alert('Anular compra', 'Se retira el inventario ingresado. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: async () => {
          try {
            await anular.mutateAsync(id);
            Alert.alert('Compra anulada');
          } catch (e) {
            Alert.alert('No se pudo anular', (e as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <Pantalla
      titulo="Compras"
      subtitulo="Facturas de proveedores"
      atras
      cargando={isRefetching}
      onRefrescar={refetch}
      accion={{ rotulo: 'Compra', onPress: () => router.push('/compras/nueva') }}
    >
      {control}
      <Tarjeta titulo={`${data.length} compras · ${dineroCorto(total)}`}>
        {error ? (
          <AvisoError mensaje={(error as Error).message} onReintentar={refetch} />
        ) : isLoading ? (
          <Cargando />
        ) : data.length === 0 ? (
          <Vacio titulo="Sin compras" texto="Registre las facturas de sus proveedores." />
        ) : (
          data.map((c) => (
            <Fila
              key={c.id}
              titulo={`${c.numero ?? ''} · ${c.proveedor_nombre ?? 'Sin proveedor'}`}
              subtitulo={fechaCorta(c.fecha)}
              onPress={() => setVerId(c.id)}
              derecha={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontWeight: '700' }}>{dinero(c.total)}</Text>
                  {c.estado === 'anulada' ? (
                    <Etiqueta texto="anulada" tono="mal" />
                  ) : c.saldo > 0 ? (
                    <Etiqueta texto={`debe ${dineroCorto(c.saldo)}`} tono="alerta" />
                  ) : (
                    <Etiqueta texto="pagada" tono="ok" />
                  )}
                </View>
              }
            />
          ))
        )}
      </Tarjeta>
      <Portal>
        <Dialog
          visible={!!verId}
          onDismiss={() => setVerId(null)}
          style={{ backgroundColor: c.superficie, maxHeight: '85%' }}
        >
          <Dialog.Title>{detalle?.numero ?? 'Compra'}</Dialog.Title>
          <Dialog.ScrollArea>
            <Pantalla incrustada>
              {!detalle ? (
                <Cargando />
              ) : (
                <>
                  <Text style={{ padding: 12, color: c.suave }}>
                    {detalle.proveedor_nombre ?? 'Sin proveedor'} · {fechaCorta(detalle.fecha)} ·{' '}
                    {detalle.forma_pago}
                  </Text>
                  {detalle.lineas.map((l) => (
                    <Fila
                      key={l.id}
                      titulo={l.producto_nombre ?? ''}
                      subtitulo={`${cantidad(l.cantidad)} x ${dinero(l.costo_unit)}`}
                      valor={dinero(l.subtotal)}
                    />
                  ))}
                  <TotalesCaja
                    filas={[
                      { nombre: 'Subtotal', valor: detalle.subtotal },
                      { nombre: 'IVA', valor: detalle.iva },
                      { nombre: 'TOTAL', valor: detalle.total, fuerte: true },
                    ]}
                  />
                </>
              )}
            </Pantalla>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            {!!detalle && detalle.saldo > 0 && (
              <Button
                onPress={() => {
                  setMonto(String(enPesos(detalle.saldo)));
                  setPagarId(detalle.id);
                  setVerId(null);
                }}
              >
                Pagar
              </Button>
            )}
            {!!detalle && detalle.estado === 'activa' && (
              <Button textColor={c.peligro} onPress={() => confirmarAnular(detalle.id)}>
                Anular
              </Button>
            )}
            <Button onPress={() => setVerId(null)}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={!!pagarId}
          onDismiss={() => setPagarId(null)}
          style={{ backgroundColor: c.superficie }}
        >
          <Dialog.Title>Pagar al proveedor</Dialog.Title>
          <Dialog.Content>
            <CampoNumero label="Monto" value={monto} onChangeText={setMonto} />
            <Opciones
              etiqueta="Paga con"
              valor={metodo}
              onCambio={setMetodo}
              opciones={[
                { valor: 'efectivo', texto: 'Efectivo' },
                { valor: 'banco', texto: 'Transferencia' },
              ]}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPagarId(null)}>Cancelar</Button>
            <Button onPress={registrarPago} loading={pagar.isPending}>
              Registrar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Pantalla>
  );
}
