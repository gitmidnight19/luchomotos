/** Ficha del repuesto: datos, kardex y ajuste de existencias. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import {
  useAjustarInventario,
  useBorrarProducto,
  useCategorias,
  useGuardarProducto,
  useInventario,
  useKardex,
} from '../../src/api/hooks';
import {
  aCentavos,
  aNumero,
  cantidad,
  dinero,
  enPesos,
  fechaCorta,
  porcentaje,
} from '../../src/lib/formato';
import {
  CampoNumero,
  CampoTexto,
  Cargando,
  Etiqueta,
  Fila,
  Kpi,
  Opciones,
  Pantalla,
  Rejilla,
  Selector,
  Tarjeta,
  Vacio,
} from '../../src/ui/componentes';
import { useTema } from '../../src/ui/temaProveedor';

export default function FichaProducto() {
  const { c } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const esNuevo = id === 'nuevo';
  const productoId = esNuevo ? 0 : Number(id);

  const { data: inventario } = useInventario();
  const { data: categorias = [] } = useCategorias();
  const { data: kardex = [] } = useKardex(productoId);
  const guardar = useGuardarProducto();
  const borrar = useBorrarProducto();
  const ajustar = useAjustarInventario();
  const router = useRouter();

  const producto = inventario?.items.find((p) => p.id === productoId);

  const [nombre, setNombre] = useState('');
  const [sku, setSku] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [precio, setPrecio] = useState('0');
  const [minimo, setMinimo] = useState('0');
  const [ubicacion, setUbicacion] = useState('');
  const [stockInicial, setStockInicial] = useState('0');
  const [costoInicial, setCostoInicial] = useState('0');

  const [dialogoAjuste, setDialogoAjuste] = useState(false);
  const [modoAjuste, setModoAjuste] = useState<'conteo' | 'delta'>('conteo');
  const [cantidadAjuste, setCantidadAjuste] = useState('0');
  const [notaAjuste, setNotaAjuste] = useState('');

  useEffect(() => {
    if (!producto) return;
    setNombre(producto.nombre);
    setSku(producto.sku ?? '');
    setCategoriaId(producto.categoria_id);
    setPrecio(String(enPesos(producto.precio_venta)));
    setMinimo(String(producto.stock_min));
    setUbicacion(producto.ubicacion ?? '');
    setCantidadAjuste(String(producto.stock));
  }, [producto]);

  if (!esNuevo && !producto && inventario) {
    return (
      <Pantalla titulo="Repuesto" atras>
        <Vacio titulo="Repuesto no encontrado" />
      </Pantalla>
    );
  }
  if (!esNuevo && !inventario)
    return (
      <Pantalla titulo="Repuesto" atras>
        <Cargando preset="tarjeta" />
      </Pantalla>
    );

  async function guardarProducto() {
    if (!nombre.trim()) {
      Alert.alert('Falta el nombre');
      return;
    }
    try {
      const datos = {
        nombre: nombre.trim(),
        sku: sku.trim() || null,
        categoria_id: categoriaId,
        precio_venta: aCentavos(precio),
        stock_min: aNumero(minimo),
        ubicacion: ubicacion || null,
        activo: true,
        ...(esNuevo
          ? { stock_inicial: aNumero(stockInicial), costo_inicial: aCentavos(costoInicial) }
          : {}),
      };
      const creado = await guardar.mutateAsync({ id: esNuevo ? undefined : productoId, datos });
      if (esNuevo) router.replace(`/producto/${creado.id}`);
      else Alert.alert('Repuesto guardado');
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    }
  }

  async function aplicarAjuste() {
    setDialogoAjuste(false);
    try {
      await ajustar.mutateAsync({
        producto_id: productoId,
        modo: modoAjuste,
        cantidad: aNumero(cantidadAjuste),
        nota: notaAjuste || null,
      });
      setNotaAjuste('');
      Alert.alert('Inventario ajustado', 'La contabilidad se actualizo automaticamente.');
    } catch (e) {
      Alert.alert('No se pudo ajustar', (e as Error).message);
    }
  }

  function confirmarBorrar() {
    Alert.alert('Retirar repuesto', 'Dejara de aparecer en las listas. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Retirar',
        style: 'destructive',
        onPress: async () => {
          await borrar.mutateAsync(productoId);
          router.back();
        },
      },
    ]);
  }

  return (
    <Pantalla
      titulo={esNuevo ? 'Nuevo repuesto' : (producto?.nombre ?? 'Repuesto')}
      subtitulo={esNuevo ? 'Ficha del repuesto' : (producto?.sku ?? undefined)}
      atras
    >
      {!!producto && (
        <Rejilla>
          <Kpi
            etiqueta="Existencia"
            valor={cantidad(producto.stock)}
            tono={producto.stock <= producto.stock_min ? 'mal' : 'ok'}
            nota={`Minimo ${cantidad(producto.stock_min)}`}
          />
          <Kpi etiqueta="Costo promedio" valor={dinero(producto.costo_promedio)} />
          <Kpi etiqueta="Valor en bodega" valor={dinero(producto.valor_costo)} tono="marca" />
          <Kpi etiqueta="Margen" valor={porcentaje(producto.margen)} />
        </Rejilla>
      )}

      <Tarjeta titulo="Datos del repuesto">
        <View style={{ padding: 14, paddingBottom: 2 }}>
          <CampoTexto label="Nombre" value={nombre} onChangeText={setNombre} />
          <CampoTexto
            label="Codigo / SKU"
            value={sku}
            onChangeText={setSku}
            autoCapitalize="characters"
          />
          <Selector
            etiqueta="Categoria"
            valor={categoriaId}
            opciones={categorias}
            texto={(c) => c.nombre}
            onCambio={setCategoriaId}
            textoVacio="Sin categoria"
          />
          <CampoNumero label="Precio de venta" value={precio} onChangeText={setPrecio} />
          <CampoNumero label="Existencia minima" value={minimo} onChangeText={setMinimo} />
          <CampoTexto label="Ubicacion en bodega" value={ubicacion} onChangeText={setUbicacion} />

          {esNuevo && (
            <>
              <Text style={{ color: c.suave, marginBottom: 10 }}>
                Si ya tiene unidades en bodega, registrelas aqui: se contabilizan como aporte de
                capital en inventario. Si va a ingresarlas con factura, deje 0 y registre una
                compra.
              </Text>
              <CampoNumero
                label="Existencia inicial"
                value={stockInicial}
                onChangeText={setStockInicial}
              />
              <CampoNumero
                label="Costo unitario inicial"
                value={costoInicial}
                onChangeText={setCostoInicial}
              />
            </>
          )}

          <Button
            mode="contained"
            onPress={guardarProducto}
            loading={guardar.isPending}
            style={{ borderRadius: 10, marginBottom: 12 }}
            contentStyle={{ paddingVertical: 6 }}
          >
            Guardar
          </Button>
        </View>
      </Tarjeta>

      {!esNuevo && (
        <>
          <Tarjeta titulo="Movimientos (kardex)">
            {kardex.length === 0 ? (
              <Vacio titulo="Sin movimientos" />
            ) : (
              [...kardex]
                .reverse()
                .slice(0, 40)
                .map((m) => (
                  <Fila
                    key={m.id}
                    titulo={`${m.tipo} · ${m.doc_tipo ?? ''} ${m.doc_id ?? ''}`}
                    subtitulo={m.nota ?? undefined}
                    detalle={fechaCorta(m.fecha)}
                    derecha={
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text
                          style={{
                            fontWeight: '700',
                            color: m.cantidad >= 0 ? c.bien : c.peligro,
                          }}
                        >
                          {m.cantidad > 0 ? '+' : ''}
                          {cantidad(m.cantidad)}
                        </Text>
                        <Text style={{ fontSize: 12, color: c.suave }}>
                          saldo {cantidad(m.saldo_cant)}
                        </Text>
                      </View>
                    }
                  />
                ))
            )}
          </Tarjeta>

          <View style={{ gap: 8, marginBottom: 24 }}>
            <Button mode="outlined" onPress={() => setDialogoAjuste(true)}>
              Ajustar existencias
            </Button>
            <Button textColor={c.peligro} onPress={confirmarBorrar}>
              Retirar repuesto
            </Button>
          </View>
        </>
      )}

      <Portal>
        <Dialog
          visible={dialogoAjuste}
          onDismiss={() => setDialogoAjuste(false)}
          style={{ backgroundColor: c.superficie }}
        >
          <Dialog.Title>Ajustar existencias</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 12, color: c.suave }}>
              Existencia registrada: {cantidad(producto?.stock ?? 0)}
            </Text>
            <Opciones
              valor={modoAjuste}
              onCambio={(v) => {
                setModoAjuste(v);
                setCantidadAjuste(v === 'conteo' ? String(producto?.stock ?? 0) : '0');
              }}
              opciones={[
                { valor: 'conteo', texto: 'Conteo fisico' },
                { valor: 'delta', texto: 'Entrada/salida' },
              ]}
            />
            <CampoNumero
              label={modoAjuste === 'conteo' ? 'Cantidad contada' : 'Diferencia (+ o -)'}
              value={cantidadAjuste}
              onChangeText={setCantidadAjuste}
            />
            <CampoTexto label="Motivo" value={notaAjuste} onChangeText={setNotaAjuste} />
            <Text style={{ color: c.suave, fontSize: 12.5 }}>
              El faltante se registra como perdida de inventario y el sobrante como otro ingreso.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogoAjuste(false)}>Cancelar</Button>
            <Button onPress={aplicarAjuste} loading={ajustar.isPending}>
              Aplicar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {!esNuevo && !!producto && producto.stock <= producto.stock_min && (
        <View style={{ marginBottom: 20 }}>
          <Etiqueta texto="Este repuesto esta por debajo del minimo" tono="alerta" />
        </View>
      )}
    </Pantalla>
  );
}
