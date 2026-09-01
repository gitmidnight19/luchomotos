/** Factura: detalle, abonos y anulacion. */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { useAnularVenta, useConfig, useRegistrarPago, useVenta } from '../../src/api/hooks';
import type { MetodoPago } from '../../src/api/tipos';
import { aCentavos, cantidad, dinero, enPesos, fechaLarga } from '../../src/lib/formato';
import {
  Boton,
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
import { useTema } from '../../src/ui/temaProveedor';

export default function Factura() {
  const { c } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ventaId = Number(id);
  const { data: venta, isLoading } = useVenta(ventaId);
  const { data: config } = useConfig();
  const anular = useAnularVenta();
  const cobrar = useRegistrarPago();

  const [dialogoCobro, setDialogoCobro] = useState(false);
  const [monto, setMonto] = useState('0');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');

  useEffect(() => {
    if (venta) setMonto(String(enPesos(venta.saldo)));
  }, [venta]);

  if (isLoading || !venta)
    return (
      <Pantalla titulo="Factura" atras>
        <Cargando preset="tarjeta" />
      </Pantalla>
    );

  async function compartir() {
    if (!venta) return;
    const lineas = venta.lineas
      .map((l) => `• ${l.descripcion} x${cantidad(l.cantidad)}  ${dinero(l.subtotal)}`)
      .join('\n');
    const texto =
      `${config?.empresa ?? 'Taller'}\n` +
      `FACTURA ${venta.numero}\n` +
      `Fecha: ${fechaLarga(venta.fecha)}\n` +
      `Cliente: ${venta.cliente_nombre ?? 'Ocasional'}\n` +
      (venta.placa ? `Moto: ${venta.placa}\n` : '') +
      `\n${lineas}\n\n` +
      `Subtotal: ${dinero(venta.subtotal)}\n` +
      `IVA: ${dinero(venta.iva)}\n` +
      `TOTAL: ${dinero(venta.total)}` +
      (venta.saldo > 0 ? `\nSaldo pendiente: ${dinero(venta.saldo)}` : '');
    await Share.share({ message: texto });
  }

  async function registrarAbono() {
    setDialogoCobro(false);
    try {
      await cobrar.mutateAsync({
        clase: 'cobro',
        doc_id: ventaId,
        monto: aCentavos(monto),
        metodo,
      });
      Alert.alert('Abono registrado');
    } catch (e) {
      Alert.alert('No se pudo registrar', (e as Error).message);
    }
  }

  function confirmarAnular() {
    Alert.alert(
      'Anular factura',
      'Se devuelve el inventario y se reversa la contabilidad. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular',
          style: 'destructive',
          onPress: async () => {
            try {
              await anular.mutateAsync(ventaId);
              Alert.alert('Factura anulada');
            } catch (e) {
              Alert.alert('No se pudo anular', (e as Error).message);
            }
          },
        },
      ],
    );
  }

  return (
    <Pantalla titulo={venta.numero ?? 'Factura'} subtitulo="Factura de venta" atras>
      <Tarjeta>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={{ fontWeight: '800' }}>
                {config?.empresa ?? 'Taller'}
              </Text>
              {!!config?.nit && <Text style={{ color: c.suave }}>NIT {config.nit}</Text>}
              {!!config?.telefono && <Text style={{ color: c.suave }}>{config.telefono}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '800' }}>{venta.numero}</Text>
              <Text style={{ color: c.suave }}>{fechaLarga(venta.fecha)}</Text>
              {venta.estado === 'anulada' ? (
                <Etiqueta texto="ANULADA" tono="mal" />
              ) : (
                <Etiqueta texto={venta.forma_pago} tono="info" />
              )}
            </View>
          </View>
          <View style={{ marginTop: 12, backgroundColor: c.fondo, padding: 10, borderRadius: 8 }}>
            <Text style={{ fontWeight: '600' }}>{venta.cliente_nombre ?? 'Cliente ocasional'}</Text>
            {!!venta.documento && <Text style={{ color: c.suave }}>Doc. {venta.documento}</Text>}
            {!!venta.telefono && <Text style={{ color: c.suave }}>Tel. {venta.telefono}</Text>}
            {!!venta.placa && (
              <Text style={{ color: c.suave }}>
                Moto: {venta.placa} {venta.marca ?? ''} {venta.linea_moto ?? ''}
              </Text>
            )}
          </View>
        </View>
      </Tarjeta>

      <Tarjeta titulo="Detalle">
        {venta.lineas.map((l) => (
          <Fila
            key={l.id}
            titulo={`${l.tipo === 'producto' ? '🔩' : '⚙'} ${l.descripcion ?? ''}`}
            subtitulo={`${cantidad(l.cantidad)} x ${dinero(l.precio_unit)} · IVA ${l.iva_pct}%`}
            valor={dinero(l.subtotal)}
          />
        ))}
      </Tarjeta>

      <Tarjeta>
        <TotalesCaja
          filas={[
            { nombre: 'Subtotal', valor: venta.subtotal },
            ...(venta.descuento ? [{ nombre: 'Descuentos', valor: -venta.descuento }] : []),
            { nombre: 'IVA', valor: venta.iva },
            { nombre: 'TOTAL', valor: venta.total, fuerte: true },
          ]}
        />
        {venta.saldo > 0 && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
            <Etiqueta texto={`Saldo pendiente ${dinero(venta.saldo)}`} tono="alerta" />
          </View>
        )}
      </Tarjeta>

      {venta.pagos.length > 0 && (
        <Tarjeta titulo="Abonos recibidos">
          {venta.pagos.map((p) => (
            <Fila
              key={p.id}
              titulo={p.metodo === 'banco' ? 'Transferencia' : 'Efectivo'}
              subtitulo={fechaLarga(p.fecha)}
              valor={dinero(p.monto)}
              tonoValor="ok"
            />
          ))}
        </Tarjeta>
      )}

      {venta.costo_total > 0 && (
        <Tarjeta titulo="Rentabilidad de la factura">
          <Fila titulo="Costo de los repuestos" valor={dinero(venta.costo_total)} />
          <Fila
            titulo="Utilidad bruta"
            valor={dinero(venta.subtotal - venta.costo_total)}
            tonoValor="ok"
          />
        </Tarjeta>
      )}

      <View style={{ gap: 8, marginBottom: 24 }}>
        {/* Lo que mueve a actuar va arriba: si queda saldo, lo primero es cobrar. */}
        {venta.estado === 'activa' && venta.saldo > 0 && (
          <Boton titulo="Registrar abono" onPress={() => setDialogoCobro(true)} />
        )}
        <Boton
          titulo="Compartir factura"
          tono={venta.estado === 'activa' && venta.saldo > 0 ? 'suave' : 'marca'}
          onPress={compartir}
        />
        {venta.estado === 'activa' && (
          <Boton
            titulo="Anular factura"
            tono="peligro"
            onPress={confirmarAnular}
            cargando={anular.isPending}
          />
        )}
      </View>

      <Portal>
        <Dialog
          visible={dialogoCobro}
          onDismiss={() => setDialogoCobro(false)}
          style={{ backgroundColor: c.superficie }}
        >
          <Dialog.Title>Registrar abono</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 10, color: c.suave }}>
              Saldo pendiente: {dinero(venta.saldo)}
            </Text>
            <CampoNumero label="Monto" value={monto} onChangeText={setMonto} />
            <Opciones
              etiqueta="Recibe en"
              valor={metodo}
              onCambio={setMetodo}
              opciones={[
                { valor: 'efectivo', texto: 'Efectivo' },
                { valor: 'banco', texto: 'Transferencia' },
              ]}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogoCobro(false)}>Cancelar</Button>
            <Button onPress={registrarAbono} loading={cobrar.isPending}>
              Registrar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {venta.lineas.length === 0 && <Vacio titulo="Factura sin lineas" />}
    </Pantalla>
  );
}
