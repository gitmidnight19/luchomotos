/** Registrar una compra: entra al inventario y recalcula el costo promedio. */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Searchbar, Text } from 'react-native-paper';

import { useCrearCompra, useProductos, useTerceros } from '../../src/api/hooks';
import type { FormaPago, MetodoPago } from '../../src/api/tipos';
import { aNumero, dinero } from '../../src/lib/formato';
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
  producto_id: number;
  nombre: string;
  cantidad: number;
  costo_unit: number;
  iva_pct: number;
  precio_venta: number;
};

export default function NuevaCompra() {
  const [busqueda, setBusqueda] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [proveedorId, setProveedorId] = useState<number | null>(null);
  const [numero, setNumero] = useState('');
  const [formaPago, setFormaPago] = useState<FormaPago>('contado');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [editando, setEditando] = useState<Linea | null>(null);

  const { data: proveedores = [] } = useTerceros('proveedor');
  const { data: productos = [] } = useProductos(busqueda.length >= 2 ? busqueda : undefined);
  const crear = useCrearCompra();
  const router = useRouter();

  const totales = useMemo(() => {
    let subtotal = 0;
    let iva = 0;
    for (const l of lineas) {
      const base = l.cantidad * l.costo_unit;
      subtotal += base;
      iva += (base * l.iva_pct) / 100;
    }
    return { subtotal, iva, total: subtotal + iva };
  }, [lineas]);

  function agregar(id: number) {
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    setBusqueda('');
    setLineas((a) => [
      ...a,
      {
        clave: `${id}-${Date.now()}`,
        producto_id: id,
        nombre: p.nombre,
        cantidad: 1,
        costo_unit: p.costo_promedio || 0,
        iva_pct: p.iva_pct ?? 19,
        precio_venta: p.precio_venta,
      },
    ]);
  }

  async function guardar() {
    if (lineas.length === 0) {
      Alert.alert('Compra vacia', 'Agregue los repuestos comprados.');
      return;
    }
    if (formaPago === 'credito' && !proveedorId) {
      Alert.alert('Falta el proveedor', 'Una compra a credito necesita proveedor.');
      return;
    }
    try {
      await crear.mutateAsync({
        proveedor_id: proveedorId,
        numero: numero || null,
        forma_pago: formaPago,
        metodo,
        lineas: lineas.map((l) => ({
          producto_id: l.producto_id,
          cantidad: l.cantidad,
          costo_unit: l.costo_unit,
          iva_pct: l.iva_pct,
          precio_venta: l.precio_venta,
        })),
      });
      Alert.alert('Compra registrada', 'El inventario y la contabilidad se actualizaron.', [
        { text: 'Listo', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('No se pudo registrar', (e as Error).message);
    }
  }

  return (
    <Pantalla>
      <Tarjeta titulo="Datos de la factura de compra">
        <View style={{ padding: 14, paddingBottom: 2 }}>
          <Selector
            etiqueta="Proveedor"
            valor={proveedorId}
            opciones={proveedores}
            texto={(p) => p.nombre}
            onCambio={setProveedorId}
            textoVacio="Sin proveedor"
          />
          <CampoTexto
            label="N° de factura del proveedor"
            value={numero}
            onChangeText={setNumero}
            placeholder="Automatico si lo deja vacio"
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
              etiqueta="Paga con"
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

      <Searchbar
        placeholder="Buscar repuesto para agregar…"
        value={busqueda}
        onChangeText={setBusqueda}
        style={{ marginBottom: 12, backgroundColor: '#fff', borderRadius: 12 }}
      />

      {busqueda.trim().length >= 2 && (
        <Tarjeta titulo="Resultados">
          {productos.length === 0 ? (
            <Vacio titulo="Sin coincidencias" texto="Cree primero el repuesto desde Inventario." />
          ) : (
            productos
              .slice(0, 8)
              .map((p) => (
                <Fila
                  key={p.id}
                  titulo={p.nombre}
                  subtitulo={`${p.sku ?? ''} · costo actual ${dinero(p.costo_promedio)}`}
                  valor={`${p.stock}`}
                  onPress={() => agregar(p.id)}
                />
              ))
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo={`Repuestos comprados (${lineas.length})`}>
        {lineas.length === 0 ? (
          <Vacio titulo="Sin repuestos" texto="Busque arriba lo que compro." />
        ) : (
          lineas.map((l, indice) => (
            <View
              key={l.clave}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: colores.linea,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{l.nombre}</Text>
                <Text style={{ color: colores.suave, fontSize: 12.5 }}>
                  {l.cantidad} x {dinero(l.costo_unit)} · IVA {l.iva_pct}%
                </Text>
                <Text style={{ color: colores.suave, fontSize: 12.5 }}>
                  Precio de venta: {dinero(l.precio_venta)}
                </Text>
              </View>
              <Text style={{ fontWeight: '700' }}>{dinero(l.cantidad * l.costo_unit)}</Text>
              <IconButton icon="pencil-outline" size={18} onPress={() => setEditando(l)} />
              <IconButton
                icon="close"
                size={18}
                onPress={() => setLineas((a) => a.filter((_, j) => j !== indice))}
              />
            </View>
          ))
        )}
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
            onPress={guardar}
            loading={crear.isPending}
            disabled={lineas.length === 0}
            buttonColor={colores.ok}
            style={{ borderRadius: 10 }}
            contentStyle={{ paddingVertical: 6 }}
          >
            Registrar compra
          </Button>
        </View>
      </Tarjeta>

      <Portal>
        <Dialog
          visible={!!editando}
          onDismiss={() => setEditando(null)}
          style={{ backgroundColor: '#fff' }}
        >
          <Dialog.Title>{editando?.nombre}</Dialog.Title>
          <Dialog.Content>
            {!!editando && (
              <>
                <CampoNumero
                  label="Cantidad"
                  value={String(editando.cantidad)}
                  onChangeText={(t) => setEditando({ ...editando, cantidad: aNumero(t) })}
                />
                <CampoNumero
                  label="Costo unitario"
                  value={String(editando.costo_unit)}
                  onChangeText={(t) => setEditando({ ...editando, costo_unit: aNumero(t) })}
                />
                <CampoNumero
                  label="IVA %"
                  value={String(editando.iva_pct)}
                  onChangeText={(t) => setEditando({ ...editando, iva_pct: aNumero(t) })}
                />
                <CampoNumero
                  label="Nuevo precio de venta"
                  value={String(editando.precio_venta)}
                  onChangeText={(t) => setEditando({ ...editando, precio_venta: aNumero(t) })}
                />
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditando(null)}>Cancelar</Button>
            <Button
              onPress={() => {
                if (editando) {
                  setLineas((a) => a.map((l) => (l.clave === editando.clave ? editando : l)));
                }
                setEditando(null);
              }}
            >
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Pantalla>
  );
}
