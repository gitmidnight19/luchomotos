/** Compras a proveedores. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Text } from 'react-native-paper';

import { useAnularCompra, useCompra, useCompras, useRegistrarPago } from '../../src/api/hooks';
import type { MetodoPago } from '../../src/api/tipos';
import { aNumero, cantidad, dinero, dineroCorto, fechaCorta } from '../../src/lib/formato';
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
import { colores } from '../../src/ui/tema';

export default function Compras() {
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
      await pagar.mutateAsync({ clase: 'pago', doc_id: id, monto: aNumero(monto), metodo });
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
    <View style={{ flex: 1 }}>
      <Pantalla cargando={isRefetching} onRefrescar={refetch}>
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
      </Pantalla>

      <FAB
        icon="plus"
        label="Compra"
        onPress={() => router.push('/compras/nueva')}
        style={{ position: 'absolute', right: 16, bottom: 20 }}
      />

      <Portal>
        <Dialog
          visible={!!verId}
          onDismiss={() => setVerId(null)}
          style={{ backgroundColor: '#fff', maxHeight: '85%' }}
        >
          <Dialog.Title>{detalle?.numero ?? 'Compra'}</Dialog.Title>
          <Dialog.ScrollArea>
            <Pantalla sinPadding>
              {!detalle ? (
                <Cargando />
              ) : (
                <>
                  <Text style={{ padding: 12, color: colores.suave }}>
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
                  setMonto(String(detalle.saldo));
                  setPagarId(detalle.id);
                  setVerId(null);
                }}
              >
                Pagar
              </Button>
            )}
            {!!detalle && detalle.estado === 'activa' && (
              <Button textColor={colores.error} onPress={() => confirmarAnular(detalle.id)}>
                Anular
              </Button>
            )}
            <Button onPress={() => setVerId(null)}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={!!pagarId}
          onDismiss={() => setPagarId(null)}
          style={{ backgroundColor: '#fff' }}
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
    </View>
  );
}
