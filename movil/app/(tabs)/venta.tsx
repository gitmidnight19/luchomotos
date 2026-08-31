/** Mostrador: arma la factura buscando repuestos y servicios. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Searchbar, Text } from 'react-native-paper';

import {
  useCrearVenta,
  useMotos,
  useProductos,
  useServicios,
  useTerceros,
} from '../../src/api/hooks';
import type { FormaPago, MetodoPago } from '../../src/api/tipos';
import { aCentavos, aNumero, dinero, enPesos, multiplicar, tasa } from '../../src/lib/formato';
import {
  CampoNumero,
  CampoTexto,
  Fila,
  Opciones,
  Pantalla,
  Selector,
  Tarjeta,
  TotalesCaja,
  Vacio,
} from '../../src/ui/componentes';
import { colores } from '../../src/ui/tema';

type Linea = {
  clave: string;
  tipo: 'producto' | 'servicio';
  producto_id?: number;
  servicio_id?: number;
  descripcion: string;
  cantidad: number;
  precio_unit: number;
  descuento: number;
  iva_pct: number;
  stock?: number;
};

export default function PuntoDeVenta() {
  const [busqueda, setBusqueda] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [motoId, setMotoId] = useState<number | null>(null);
  const [formaPago, setFormaPago] = useState<FormaPago>('contado');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [editando, setEditando] = useState<Linea | null>(null);

  const { data: productos = [] } = useProductos(busqueda.length >= 2 ? busqueda : undefined);
  const { data: servicios = [] } = useServicios();
  const { data: clientes = [] } = useTerceros('cliente');
  const { data: motos = [] } = useMotos();
  const crearVenta = useCrearVenta();
  const router = useRouter();

  const sugerencias = useMemo(() => {
    if (busqueda.trim().length < 2) return { productos: [], servicios: [] };
    const texto = busqueda.toLowerCase();
    return {
      productos: productos.slice(0, 8),
      servicios: servicios.filter((s) => s.nombre.toLowerCase().includes(texto)).slice(0, 6),
    };
  }, [busqueda, productos, servicios]);

  const motosDelCliente = clienteId ? motos.filter((m) => m.cliente_id === clienteId) : motos;

  const totales = useMemo(() => {
    let subtotal = 0;
    let iva = 0;
    for (const l of lineas) {
      const base = multiplicar(l.precio_unit, l.cantidad) - l.descuento;
      subtotal += base;
      iva += tasa(base, l.iva_pct);
    }
    return { subtotal, iva, total: subtotal + iva };
  }, [lineas]);

  function agregarProducto(id: number) {
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    setBusqueda('');
    setLineas((actuales) => {
      const existente = actuales.find((l) => l.producto_id === id);
      if (existente) {
        return actuales.map((l) =>
          l.clave === existente.clave ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [
        ...actuales,
        {
          clave: `p${id}-${Date.now()}`,
          tipo: 'producto',
          producto_id: id,
          descripcion: p.nombre,
          cantidad: 1,
          precio_unit: p.precio_venta,
          descuento: 0,
          iva_pct: p.iva_pct ?? 19,
          stock: p.stock,
        },
      ];
    });
  }

  function agregarServicio(id: number) {
    const s = servicios.find((x) => x.id === id);
    if (!s) return;
    setBusqueda('');
    setLineas((actuales) => [
      ...actuales,
      {
        clave: `s${id}-${Date.now()}`,
        tipo: 'servicio',
        servicio_id: id,
        descripcion: s.nombre,
        cantidad: 1,
        precio_unit: s.precio,
        descuento: 0,
        iva_pct: 19,
      },
    ]);
  }

  function cambiarCantidad(clave: string, delta: number) {
    setLineas((actuales) =>
      actuales
        .map((l) => (l.clave === clave ? { ...l, cantidad: Math.max(l.cantidad + delta, 0) } : l))
        .filter((l) => l.cantidad > 0),
    );
  }

  function guardarEdicion() {
    if (!editando) return;
    setLineas((actuales) => actuales.map((l) => (l.clave === editando.clave ? editando : l)));
    setEditando(null);
  }

  async function registrar() {
    if (lineas.length === 0) {
      Alert.alert('Factura vacia', 'Agregue al menos un repuesto o servicio.');
      return;
    }
    if (formaPago === 'credito' && !clienteId) {
      Alert.alert('Falta el cliente', 'Una venta a credito necesita un cliente registrado.');
      return;
    }
    try {
      const creada = await crearVenta.mutateAsync({
        cliente_id: clienteId,
        moto_id: motoId,
        forma_pago: formaPago,
        metodo,
        lineas: lineas.map((l) => ({
          tipo: l.tipo,
          producto_id: l.producto_id ?? null,
          servicio_id: l.servicio_id ?? null,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unit: l.precio_unit,
          descuento: l.descuento,
          iva_pct: l.iva_pct,
        })),
      });
      setLineas([]);
      setMotoId(null);
      Alert.alert('Venta registrada', `Factura ${creada.numero ?? ''}`, [
        { text: 'Nueva venta' },
        { text: 'Ver factura', onPress: () => router.push(`/ventas/${creada.id}`) },
      ]);
    } catch (e) {
      Alert.alert('No se pudo registrar', (e as Error).message);
    }
  }

  const excedeStock = lineas.some((l) => l.stock !== undefined && l.cantidad > l.stock);

  return (
    <Pantalla>
      <Searchbar
        placeholder="Buscar repuesto o servicio…"
        value={busqueda}
        onChangeText={setBusqueda}
        style={{ marginBottom: 12, backgroundColor: '#fff', borderRadius: 12 }}
        inputStyle={{ fontSize: 15 }}
      />

      {busqueda.trim().length >= 2 && (
        <Tarjeta titulo="Resultados">
          {sugerencias.productos.length === 0 && sugerencias.servicios.length === 0 ? (
            <Vacio titulo="Sin coincidencias" texto="Pruebe con otra palabra o el codigo." />
          ) : (
            <>
              {sugerencias.productos.map((p) => (
                <Fila
                  key={`p${p.id}`}
                  titulo={p.nombre}
                  subtitulo={`${p.sku ?? ''} · existencia ${p.stock}`}
                  valor={dinero(p.precio_venta)}
                  onPress={() => agregarProducto(p.id)}
                />
              ))}
              {sugerencias.servicios.map((s) => (
                <Fila
                  key={`s${s.id}`}
                  titulo={`⚙ ${s.nombre}`}
                  subtitulo={s.duracion_min ? `${s.duracion_min} min` : undefined}
                  valor={dinero(s.precio)}
                  onPress={() => agregarServicio(s.id)}
                />
              ))}
            </>
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo={`Detalle (${lineas.length})`}>
        {lineas.length === 0 ? (
          <Vacio titulo="Factura vacia" texto="Busque arriba lo que va a vender." />
        ) : (
          lineas.map((l) => (
            <View key={l.clave}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditando(l)}>
                  <Text style={{ fontWeight: '600' }} numberOfLines={2}>
                    {l.tipo === 'producto' ? '🔩 ' : '⚙ '}
                    {l.descripcion}
                  </Text>
                  <Text style={{ color: colores.suave, fontSize: 12.5, marginTop: 2 }}>
                    {dinero(l.precio_unit)} c/u · IVA {l.iva_pct}%
                    {l.descuento ? ` · desc. ${dinero(l.descuento)}` : ''}
                  </Text>
                  {l.stock !== undefined && l.cantidad > l.stock && (
                    <Text style={{ color: colores.error, fontSize: 12, marginTop: 2 }}>
                      Solo hay {l.stock} en existencia
                    </Text>
                  )}
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconButton
                    icon="minus-circle-outline"
                    size={22}
                    onPress={() => cambiarCantidad(l.clave, -1)}
                  />
                  <Text style={{ minWidth: 22, textAlign: 'center', fontWeight: '700' }}>
                    {l.cantidad}
                  </Text>
                  <IconButton
                    icon="plus-circle-outline"
                    size={22}
                    onPress={() => cambiarCantidad(l.clave, 1)}
                  />
                </View>
              </View>
              <View style={{ paddingHorizontal: 12, paddingBottom: 10, alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '700' }}>
                  {dinero(multiplicar(l.precio_unit, l.cantidad) - l.descuento)}
                </Text>
              </View>
            </View>
          ))
        )}
      </Tarjeta>

      <Tarjeta titulo="Datos de la factura">
        <View style={{ padding: 14, paddingBottom: 2 }}>
          <Selector
            etiqueta="Cliente"
            valor={clienteId}
            opciones={clientes}
            texto={(c) => c.nombre}
            onCambio={(id) => {
              setClienteId(id);
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
            textoVacio="Sin moto asociada"
          />
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
        </View>
      </Tarjeta>

      <Tarjeta>
        <TotalesCaja
          filas={[
            { nombre: 'Subtotal', valor: totales.subtotal },
            { nombre: 'IVA', valor: totales.iva },
            { nombre: 'TOTAL', valor: totales.total, fuerte: true },
          ]}
        />
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <Button
            mode="contained"
            onPress={registrar}
            loading={crearVenta.isPending}
            disabled={crearVenta.isPending || lineas.length === 0 || excedeStock}
            buttonColor={colores.ok}
            contentStyle={{ paddingVertical: 8 }}
            style={{ borderRadius: 10 }}
            icon={() => <MaterialCommunityIcons name="check" size={20} color="#fff" />}
          >
            Registrar venta
          </Button>
          {lineas.length > 0 && (
            <Button
              onPress={() => setLineas([])}
              textColor={colores.suave}
              style={{ marginTop: 6 }}
            >
              Vaciar
            </Button>
          )}
        </View>
      </Tarjeta>

      <Portal>
        <Dialog
          visible={!!editando}
          onDismiss={() => setEditando(null)}
          style={{ backgroundColor: '#fff' }}
        >
          <Dialog.Title>Editar linea</Dialog.Title>
          <Dialog.Content>
            {!!editando && (
              <>
                <CampoTexto
                  label="Descripcion"
                  value={editando.descripcion}
                  onChangeText={(t) => setEditando({ ...editando, descripcion: t })}
                />
                <CampoNumero
                  label="Cantidad"
                  value={String(editando.cantidad)}
                  onChangeText={(t) => setEditando({ ...editando, cantidad: aNumero(t) })}
                />
                <CampoNumero
                  label="Precio unitario"
                  value={String(enPesos(editando.precio_unit))}
                  onChangeText={(t) => setEditando({ ...editando, precio_unit: aCentavos(t) })}
                />
                <CampoNumero
                  label="Descuento"
                  value={String(enPesos(editando.descuento))}
                  onChangeText={(t) => setEditando({ ...editando, descuento: aCentavos(t) })}
                />
                <CampoNumero
                  label="IVA %"
                  value={String(editando.iva_pct)}
                  onChangeText={(t) => setEditando({ ...editando, iva_pct: aNumero(t) })}
                />
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditando(null)}>Cancelar</Button>
            <Button onPress={guardarEdicion}>Guardar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Pantalla>
  );
}
