/** Directorio de clientes y proveedores con sus saldos. */
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Searchbar } from 'react-native-paper';

import { useBorrarTercero, useGuardarTercero, useTerceros } from '../src/api/hooks';
import type { Tercero, TipoTercero } from '../src/api/tipos';
import { dinero } from '../src/lib/formato';
import {
  CampoTexto,
  Cargando,
  Etiqueta,
  Fila,
  Opciones,
  Pantalla,
  Tarjeta,
  Vacio,
} from '../src/ui/componentes';
import { colores } from '../src/ui/tema';

const VACIO = {
  nombre: '',
  tipo: 'cliente' as TipoTercero,
  documento: '',
  telefono: '',
  email: '',
  direccion: '',
  notas: '',
};

export default function Clientes() {
  const { data = [], isLoading, isRefetching, refetch } = useTerceros();
  const guardar = useGuardarTercero();
  const borrar = useBorrarTercero();

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'cliente' | 'proveedor'>('todos');
  const [editando, setEditando] = useState<(typeof VACIO & { id?: number }) | null>(null);

  const lista = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return data.filter((t) => {
      const coincide =
        !texto ||
        `${t.nombre} ${t.documento ?? ''} ${t.telefono ?? ''}`.toLowerCase().includes(texto);
      const tipoOk = filtro === 'todos' || t.tipo === filtro || t.tipo === 'ambos';
      return coincide && tipoOk;
    });
  }, [data, busqueda, filtro]);

  function abrir(t?: Tercero) {
    setEditando(
      t
        ? {
            id: t.id,
            nombre: t.nombre,
            tipo: t.tipo,
            documento: t.documento ?? '',
            telefono: t.telefono ?? '',
            email: t.email ?? '',
            direccion: t.direccion ?? '',
            notas: t.notas ?? '',
          }
        : { ...VACIO },
    );
  }

  async function guardarTercero() {
    if (!editando?.nombre.trim()) {
      Alert.alert('Falta el nombre');
      return;
    }
    try {
      const { id, ...datos } = editando;
      await guardar.mutateAsync({ id, datos: { ...datos, activo: true } });
      setEditando(null);
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    }
  }

  function confirmarBorrar(id: number) {
    Alert.alert('Retirar del directorio', '¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Retirar',
        style: 'destructive',
        onPress: async () => {
          await borrar.mutateAsync(id);
          setEditando(null);
        },
      },
    ]);
  }

  if (isLoading) return <Cargando />;

  return (
    <View style={{ flex: 1 }}>
      <Pantalla cargando={isRefetching} onRefrescar={refetch}>
        <Searchbar
          placeholder="Buscar por nombre, documento o telefono…"
          value={busqueda}
          onChangeText={setBusqueda}
          style={{ marginBottom: 12, backgroundColor: '#fff', borderRadius: 12 }}
        />
        <Opciones
          valor={filtro}
          onCambio={setFiltro}
          opciones={[
            { valor: 'todos', texto: 'Todos' },
            { valor: 'cliente', texto: 'Clientes' },
            { valor: 'proveedor', texto: 'Proveedores' },
          ]}
        />

        <Tarjeta titulo={`${lista.length} registros`}>
          {lista.length === 0 ? (
            <Vacio titulo="Sin registros" texto="Agregue sus clientes y proveedores." />
          ) : (
            lista.map((t) => (
              <Fila
                key={t.id}
                titulo={t.nombre}
                subtitulo={[t.documento, t.telefono].filter(Boolean).join(' · ') || undefined}
                onPress={() => abrir(t)}
                derecha={
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Etiqueta texto={t.tipo} tono="info" />
                    {t.deuda > 0 && (
                      <Etiqueta texto={`nos debe ${dinero(t.deuda)}`} tono="alerta" />
                    )}
                    {t.pordar > 0 && (
                      <Etiqueta texto={`le debemos ${dinero(t.pordar)}`} tono="mal" />
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
        label="Nuevo"
        onPress={() => abrir()}
        style={{ position: 'absolute', right: 16, bottom: 20 }}
      />

      <Portal>
        <Dialog
          visible={!!editando}
          onDismiss={() => setEditando(null)}
          style={{ backgroundColor: '#fff', maxHeight: '85%' }}
        >
          <Dialog.Title>{editando?.id ? 'Editar' : 'Nuevo registro'}</Dialog.Title>
          <Dialog.ScrollArea>
            <Pantalla sinPadding>
              {!!editando && (
                <View style={{ padding: 14 }}>
                  <CampoTexto
                    label="Nombre o razon social"
                    value={editando.nombre}
                    onChangeText={(t) => setEditando({ ...editando, nombre: t })}
                  />
                  <Opciones
                    etiqueta="Tipo"
                    valor={editando.tipo}
                    onCambio={(v) => setEditando({ ...editando, tipo: v })}
                    opciones={[
                      { valor: 'cliente' as TipoTercero, texto: 'Cliente' },
                      { valor: 'proveedor' as TipoTercero, texto: 'Proveedor' },
                      { valor: 'ambos' as TipoTercero, texto: 'Ambos' },
                    ]}
                  />
                  <CampoTexto
                    label="Documento / NIT"
                    value={editando.documento}
                    onChangeText={(t) => setEditando({ ...editando, documento: t })}
                  />
                  <CampoTexto
                    label="Telefono"
                    value={editando.telefono}
                    onChangeText={(t) => setEditando({ ...editando, telefono: t })}
                    keyboardType="phone-pad"
                  />
                  <CampoTexto
                    label="Correo"
                    value={editando.email}
                    onChangeText={(t) => setEditando({ ...editando, email: t })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <CampoTexto
                    label="Direccion"
                    value={editando.direccion}
                    onChangeText={(t) => setEditando({ ...editando, direccion: t })}
                  />
                  {!!editando.id && (
                    <Button
                      textColor={colores.error}
                      onPress={() => confirmarBorrar(editando.id!)}
                      style={{ marginTop: 4 }}
                    >
                      Retirar del directorio
                    </Button>
                  )}
                </View>
              )}
            </Pantalla>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditando(null)}>Cancelar</Button>
            <Button onPress={guardarTercero} loading={guardar.isPending}>
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
