/** Orden de trabajo: recibir la moto, anotar el trabajo y facturarla. */
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper';

import {
  useAnularOrden,
  useCrearOrden,
  useEditarOrden,
  useFacturarOrden,
  useMotos,
  useOrden,
  useProductos,
  useServicios,
  useTerceros,
} from '../../src/api/hooks';
import type { EstadoOrden, FormaPago, ItemOrdenEntrada, MetodoPago } from '../../src/api/tipos';
import { aNumero, dinero } from '../../src/lib/formato';
import {
  CampoNumero,
  CampoTexto,
  Cargando,
  Etiqueta,
  Opciones,
  Pantalla,
  Selector,
  Tarjeta,
  TotalesCaja,
  Vacio,
} from '../../src/ui/componentes';
import { colores } from '../../src/ui/tema';

type Item = ItemOrdenEntrada & { clave: string; iva_pct: number };

export default function OrdenTrabajo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const esNueva = id === 'nueva';
  const ordenId = esNueva ? 0 : Number(id);

  const { data: orden, isLoading } = useOrden(ordenId);
  const { data: clientes = [] } = useTerceros('cliente');
  const { data: motos = [] } = useMotos();
  const { data: servicios = [] } = useServicios();
  const { data: productos = [] } = useProductos();

  const crear = useCrearOrden();
  const editar = useEditarOrden();
  const facturar = useFacturarOrden();
  const anular = useAnularOrden();

  const router = useRouter();
  const navigation = useNavigation();

  const [clienteId, setClienteId] = useState<number | null>(null);
  const [motoId, setMotoId] = useState<number | null>(null);
  const [km, setKm] = useState('');
  const [estado, setEstado] = useState<EstadoOrden>('abierta');
  const [mecanico, setMecanico] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [notas, setNotas] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [agregando, setAgregando] = useState<'servicio' | 'producto' | null>(null);
  const [dialogoFacturar, setDialogoFacturar] = useState(false);
  const [formaPago, setFormaPago] = useState<FormaPago>('contado');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');

  useEffect(() => {
    navigation.setOptions({ title: esNueva ? 'Nueva orden' : (orden?.numero ?? 'Orden') });
  }, [navigation, orden, esNueva]);

  useEffect(() => {
    if (!orden) return;
    setClienteId(orden.cliente_id);
    setMotoId(orden.moto_id);
    setKm(orden.km ? String(orden.km) : '');
    setEstado(orden.estado);
    setMecanico(orden.mecanico ?? '');
    setDiagnostico(orden.diagnostico ?? '');
    setNotas(orden.notas ?? '');
    setItems(
      orden.items.map((i, indice) => ({
        clave: `i${i.id}-${indice}`,
        tipo: i.tipo,
        producto_id: i.producto_id,
        servicio_id: i.servicio_id,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precio_unit: i.precio_unit,
        iva_pct: i.iva_pct,
      })),
    );
  }, [orden]);

  if (!esNueva && isLoading) return <Cargando />;

  const facturada = orden?.estado === 'facturada';
  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unit, 0);
  const iva = items.reduce((s, i) => s + (i.cantidad * i.precio_unit * (i.iva_pct ?? 0)) / 100, 0);

  function cuerpo() {
    return {
      cliente_id: clienteId,
      moto_id: motoId,
      km: km ? Number(aNumero(km)) : null,
      estado,
      mecanico: mecanico || null,
      diagnostico: diagnostico || null,
      notas: notas || null,
      items: items.map((i) => ({
        tipo: i.tipo,
        producto_id: i.producto_id ?? null,
        servicio_id: i.servicio_id ?? null,
        descripcion: i.descripcion ?? null,
        cantidad: i.cantidad,
        precio_unit: i.precio_unit,
        iva_pct: i.iva_pct,
      })),
    };
  }

  async function guardar() {
    try {
      if (esNueva) {
        const creada = await crear.mutateAsync(cuerpo());
        router.replace(`/orden/${creada.id}`);
      } else {
        await editar.mutateAsync({ id: ordenId, datos: cuerpo() });
        Alert.alert('Orden guardada');
      }
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    }
  }

  async function confirmarFacturar() {
    setDialogoFacturar(false);
    try {
      const venta = await facturar.mutateAsync({
        id: ordenId,
        datos: { forma_pago: formaPago, metodo },
      });
      Alert.alert('Factura generada', `Numero ${venta.numero ?? ''}`, [
        { text: 'Ver factura', onPress: () => router.replace(`/ventas/${venta.id}`) },
      ]);
    } catch (e) {
      Alert.alert('No se pudo facturar', (e as Error).message);
    }
  }

  function confirmarAnular() {
    Alert.alert('Anular orden', 'La orden quedara anulada. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: async () => {
          await anular.mutateAsync(ordenId);
          router.back();
        },
      },
    ]);
  }

  function agregarItem(tipo: 'servicio' | 'producto', idElegido: number) {
    if (tipo === 'servicio') {
      const s = servicios.find((x) => x.id === idElegido);
      if (!s) return;
      setItems((a) => [
        ...a,
        {
          clave: `s${idElegido}-${Date.now()}`,
          tipo: 'servicio',
          servicio_id: idElegido,
          descripcion: s.nombre,
          cantidad: 1,
          precio_unit: s.precio,
          iva_pct: 19,
        },
      ]);
    } else {
      const p = productos.find((x) => x.id === idElegido);
      if (!p) return;
      setItems((a) => [
        ...a,
        {
          clave: `p${idElegido}-${Date.now()}`,
          tipo: 'producto',
          producto_id: idElegido,
          descripcion: p.nombre,
          cantidad: 1,
          precio_unit: p.precio_venta,
          iva_pct: p.iva_pct ?? 19,
        },
      ]);
    }
    setAgregando(null);
  }

  const motosDelCliente = clienteId ? motos.filter((m) => m.cliente_id === clienteId) : motos;

  return (
    <Pantalla>
      {facturada && (
        <Tarjeta>
          <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Etiqueta texto="facturada" tono="gris" />
            <Text style={{ color: colores.suave, flex: 1 }}>
              Esta orden ya se facturo y no se puede modificar.
            </Text>
          </View>
          {!!orden?.venta_id && (
            <Button onPress={() => router.push(`/ventas/${orden.venta_id}`)}>Ver la factura</Button>
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo="Recepcion de la moto">
        <View style={{ padding: 14, paddingBottom: 2 }}>
          <Selector
            etiqueta="Cliente"
            valor={clienteId}
            opciones={clientes}
            texto={(c) => c.nombre}
            onCambio={(v) => {
              setClienteId(v);
              setMotoId(null);
            }}
            textoVacio="Cliente ocasional"
          />
          <Selector
            etiqueta="Moto"
            valor={motoId}
            opciones={motosDelCliente}
            texto={(m) => `${m.placa ?? 'sin placa'} · ${m.marca ?? ''} ${m.linea ?? ''}`.trim()}
            onCambio={setMotoId}
            textoVacio="Sin moto"
          />
          <CampoNumero label="Kilometraje" value={km} onChangeText={setKm} />
          <CampoTexto label="Mecanico" value={mecanico} onChangeText={setMecanico} />
          <CampoTexto
            label="Diagnostico / falla reportada"
            value={diagnostico}
            onChangeText={setDiagnostico}
            multiline
            numberOfLines={3}
          />
          {!facturada && (
            <Opciones
              etiqueta="Estado"
              valor={estado}
              onCambio={(v) => setEstado(v as EstadoOrden)}
              opciones={[
                { valor: 'abierta' as EstadoOrden, texto: 'Abierta' },
                { valor: 'en_proceso' as EstadoOrden, texto: 'En proceso' },
                { valor: 'terminada' as EstadoOrden, texto: 'Terminada' },
              ]}
            />
          )}
        </View>
      </Tarjeta>

      <Tarjeta titulo="Trabajo y repuestos">
        {items.length === 0 ? (
          <Vacio titulo="Sin items" texto="Agregue la mano de obra y los repuestos usados." />
        ) : (
          items.map((i, indice) => (
            <View
              key={i.clave}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: colores.linea,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>
                  {i.tipo === 'producto' ? '🔩 ' : '⚙ '}
                  {i.descripcion}
                </Text>
                <Text style={{ color: colores.suave, fontSize: 12.5 }}>
                  {i.cantidad} x {dinero(i.precio_unit)}
                </Text>
              </View>
              <Text style={{ fontWeight: '700', marginRight: 4 }}>
                {dinero(i.cantidad * i.precio_unit)}
              </Text>
              {!facturada && (
                <IconButton
                  icon="close"
                  size={18}
                  onPress={() => setItems((a) => a.filter((_, j) => j !== indice))}
                />
              )}
            </View>
          ))
        )}
        {!facturada && (
          <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
            <Button mode="outlined" onPress={() => setAgregando('servicio')} style={{ flex: 1 }}>
              + Servicio
            </Button>
            <Button mode="outlined" onPress={() => setAgregando('producto')} style={{ flex: 1 }}>
              + Repuesto
            </Button>
          </View>
        )}
      </Tarjeta>

      <Tarjeta>
        <TotalesCaja
          filas={[
            { nombre: 'Subtotal', valor: subtotal },
            { nombre: 'IVA', valor: iva },
            { nombre: 'TOTAL', valor: subtotal + iva, fuerte: true },
          ]}
        />
      </Tarjeta>

      {!facturada && (
        <View style={{ gap: 8, marginBottom: 20 }}>
          <Button
            mode="contained"
            onPress={guardar}
            loading={crear.isPending || editar.isPending}
            contentStyle={{ paddingVertical: 6 }}
            style={{ borderRadius: 10 }}
          >
            {esNueva ? 'Crear orden' : 'Guardar cambios'}
          </Button>
          {!esNueva && (
            <>
              <Button
                mode="contained"
                buttonColor={colores.ok}
                onPress={() => setDialogoFacturar(true)}
                contentStyle={{ paddingVertical: 6 }}
                style={{ borderRadius: 10 }}
                disabled={items.length === 0}
              >
                Facturar orden
              </Button>
              <Button textColor={colores.error} onPress={confirmarAnular}>
                Anular orden
              </Button>
            </>
          )}
        </View>
      )}

      <Portal>
        <Dialog
          visible={agregando !== null}
          onDismiss={() => setAgregando(null)}
          style={{ backgroundColor: '#fff', maxHeight: '75%' }}
        >
          <Dialog.Title>{agregando === 'servicio' ? 'Servicios' : 'Repuestos'}</Dialog.Title>
          <Dialog.ScrollArea>
            <Pantalla sinPadding>
              {(agregando === 'servicio' ? servicios : productos).map((x) => (
                <Button
                  key={x.id}
                  onPress={() => agregarItem(agregando!, x.id)}
                  contentStyle={{ justifyContent: 'flex-start' }}
                  textColor={colores.texto}
                >
                  {'precio' in x
                    ? `${x.nombre} · ${dinero(x.precio)}`
                    : `${x.nombre} · ${dinero(x.precio_venta)} (${x.stock})`}
                </Button>
              ))}
            </Pantalla>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setAgregando(null)}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={dialogoFacturar}
          onDismiss={() => setDialogoFacturar(false)}
          style={{ backgroundColor: '#fff' }}
        >
          <Dialog.Title>Facturar orden</Dialog.Title>
          <Dialog.Content>
            <Opciones
              etiqueta="Forma de pago"
              valor={formaPago}
              onCambio={setFormaPago}
              opciones={[
                { valor: 'contado', texto: 'Contado' },
                { valor: 'credito', texto: 'Credito' },
              ]}
            />
            {formaPago === 'contado' && (
              <Opciones
                etiqueta="Recibe en"
                valor={metodo}
                onCambio={setMetodo}
                opciones={[
                  { valor: 'efectivo', texto: 'Efectivo' },
                  { valor: 'banco', texto: 'Transferencia' },
                ]}
              />
            )}
            <Text style={{ color: colores.suave }}>
              Se genera la factura, se descarga el inventario y se contabiliza automaticamente.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogoFacturar(false)}>Cancelar</Button>
            <Button onPress={confirmarFacturar} loading={facturar.isPending}>
              Facturar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Pantalla>
  );
}
