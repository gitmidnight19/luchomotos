/** Gastos del taller: arriendo, servicios, nomina, insumos. */
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import {
  useAnularGasto,
  useCrearGasto,
  useCuentas,
  useGastos,
  useTerceros,
} from '../src/api/hooks';
import type { MetodoGasto } from '../src/api/tipos';
import { aCentavos, dinero, dineroCorto, fechaCorta, porcentaje } from '../src/lib/formato';
import {
  AvisoError,
  CampoNumero,
  CampoTexto,
  Cargando,
  Fila,
  Kpi,
  Opciones,
  Pantalla,
  Rejilla,
  Selector,
  Tarjeta,
  Vacio,
} from '../src/ui/componentes';
import { usePeriodo } from '../src/ui/periodo';
import { useTema } from '../src/ui/temaProveedor';

export default function Gastos() {
  const { c } = useTema();
  const { desde, hasta, control } = usePeriodo('mes');
  const { data = [], isLoading, isRefetching, error, refetch } = useGastos(desde, hasta);
  const { data: cuentas = [] } = useCuentas();
  const { data: proveedores = [] } = useTerceros('proveedor');
  const crear = useCrearGasto();
  const anularGasto = useAnularGasto();

  const [nuevo, setNuevo] = useState(false);
  const [cuentaId, setCuentaId] = useState<number | null>(null);
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [metodo, setMetodo] = useState<MetodoGasto>('efectivo');
  const [proveedorId, setProveedorId] = useState<number | null>(null);

  const cuentasGasto = useMemo(
    () =>
      cuentas
        .filter((c) => c.tipo === 'GASTO' || c.tipo === 'COSTO')
        .map((c) => ({ ...c, etiqueta: `${c.codigo} · ${c.nombre}` })),
    [cuentas],
  );

  const activos = useMemo(() => data.filter((g) => g.estado === 'activo'), [data]);
  const total = activos.reduce((s, g) => s + g.monto, 0);
  const porConcepto = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const g of activos) {
      const clave = g.cuenta_nombre ?? 'Otros';
      mapa.set(clave, (mapa.get(clave) ?? 0) + g.monto);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }, [activos]);

  async function guardar() {
    if (!cuentaId) {
      Alert.alert('Falta el concepto', 'Elija a que cuenta va el gasto.');
      return;
    }
    if (aCentavos(monto) <= 0) {
      Alert.alert('Monto invalido');
      return;
    }
    try {
      await crear.mutateAsync({
        cuenta_id: cuentaId,
        monto: aCentavos(monto),
        descripcion: descripcion || null,
        metodo,
        proveedor_id: metodo === 'credito' ? proveedorId : null,
      });
      setNuevo(false);
      setMonto('');
      setDescripcion('');
      Alert.alert('Gasto registrado');
    } catch (e) {
      Alert.alert('No se pudo registrar', (e as Error).message);
    }
  }

  function confirmarAnular(id: number) {
    Alert.alert('Anular gasto', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Anular', style: 'destructive', onPress: () => anularGasto.mutateAsync(id) },
    ]);
  }

  return (
    <Pantalla
      titulo="Gastos"
      subtitulo="Arriendo, servicios, nomina"
      atras
      cargando={isRefetching}
      onRefrescar={refetch}
      accion={{ rotulo: 'Gasto', onPress: () => setNuevo(true) }}
    >
      {control}
      <Rejilla>
        <Kpi etiqueta="Gastos del periodo" valor={dineroCorto(total)} tono="marca" />
        <Kpi etiqueta="Registros" valor={String(activos.length)} />
      </Rejilla>

      {error ? (
        <AvisoError mensaje={(error as Error).message} onReintentar={refetch} />
      ) : isLoading ? (
        <Cargando />
      ) : (
        <>
          <Tarjeta titulo="Resumen por concepto">
            {porConcepto.length === 0 ? (
              <Vacio titulo="Sin gastos" />
            ) : (
              porConcepto.map(([nombre, valor]) => (
                <Fila
                  key={nombre}
                  titulo={nombre}
                  subtitulo={porcentaje(total ? (valor / total) * 100 : 0)}
                  valor={dinero(valor)}
                />
              ))
            )}
          </Tarjeta>

          <Tarjeta titulo="Movimientos">
            {data.length === 0 ? (
              <Vacio titulo="Sin gastos" texto="Registre el arriendo, los servicios y la nomina." />
            ) : (
              data.map((g) => (
                <Fila
                  key={g.id}
                  titulo={g.descripcion || g.cuenta_nombre || 'Gasto'}
                  subtitulo={`${g.cuenta_codigo ?? ''} · ${g.metodo}`}
                  detalle={fechaCorta(g.fecha)}
                  onPress={g.estado === 'activo' ? () => confirmarAnular(g.id) : undefined}
                  derecha={
                    <Text
                      style={{
                        fontWeight: '700',
                        color: g.estado === 'anulado' ? c.suave : c.texto,
                        textDecorationLine: g.estado === 'anulado' ? 'line-through' : 'none',
                      }}
                    >
                      {dinero(g.monto)}
                    </Text>
                  }
                />
              ))
            )}
          </Tarjeta>
        </>
      )}
      <Portal>
        <Dialog
          visible={nuevo}
          onDismiss={() => setNuevo(false)}
          style={{ backgroundColor: c.superficie }}
        >
          <Dialog.Title>Registrar gasto</Dialog.Title>
          <Dialog.ScrollArea>
            <Pantalla incrustada>
              <View style={{ padding: 14 }}>
                <CampoNumero label="Monto" value={monto} onChangeText={setMonto} />
                <Selector
                  etiqueta="Concepto contable"
                  valor={cuentaId}
                  opciones={cuentasGasto}
                  texto={(c) => c.etiqueta}
                  onCambio={setCuentaId}
                  textoVacio="Elija el concepto"
                  permiteVacio={false}
                />
                <CampoTexto
                  label="Descripcion"
                  value={descripcion}
                  onChangeText={setDescripcion}
                  placeholder="Ej: arriendo de agosto"
                />
                <Opciones
                  etiqueta="Forma de pago"
                  valor={metodo}
                  onCambio={setMetodo}
                  opciones={[
                    { valor: 'efectivo', texto: 'Efectivo' },
                    { valor: 'banco', texto: 'Banco' },
                    { valor: 'credito', texto: 'Queda debiendo' },
                  ]}
                />
                {metodo === 'credito' && (
                  <Selector
                    etiqueta="Proveedor (opcional)"
                    valor={proveedorId}
                    opciones={proveedores}
                    texto={(p) => p.nombre}
                    onCambio={setProveedorId}
                  />
                )}
              </View>
            </Pantalla>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setNuevo(false)}>Cancelar</Button>
            <Button onPress={guardar} loading={crear.isPending}>
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Pantalla>
  );
}
