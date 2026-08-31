/** Parque de motos atendidas por el taller. */
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Searchbar } from 'react-native-paper';

import { useBorrarMoto, useGuardarMoto, useMotos, useTerceros } from '../src/api/hooks';
import type { Moto } from '../src/api/tipos';
import {
  CampoTexto,
  Cargando,
  Fila,
  Pantalla,
  Selector,
  Tarjeta,
  Vacio,
} from '../src/ui/componentes';
import { colores } from '../src/ui/tema';

const VACIA = {
  placa: '',
  cliente_id: null as number | null,
  marca: '',
  linea: '',
  modelo: '',
  cilindraje: '',
  color: '',
  notas: '',
};

export default function Motos() {
  const { data = [], isLoading, isRefetching, refetch } = useMotos();
  const { data: clientes = [] } = useTerceros('cliente');
  const guardar = useGuardarMoto();
  const borrar = useBorrarMoto();

  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<(typeof VACIA & { id?: number }) | null>(null);

  const lista = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return data;
    return data.filter((m) =>
      `${m.placa ?? ''} ${m.marca ?? ''} ${m.linea ?? ''} ${m.cliente_nombre ?? ''}`
        .toLowerCase()
        .includes(texto),
    );
  }, [data, busqueda]);

  function abrir(m?: Moto) {
    setEditando(
      m
        ? {
            id: m.id,
            placa: m.placa ?? '',
            cliente_id: m.cliente_id,
            marca: m.marca ?? '',
            linea: m.linea ?? '',
            modelo: m.modelo ?? '',
            cilindraje: m.cilindraje ?? '',
            color: m.color ?? '',
            notas: m.notas ?? '',
          }
        : { ...VACIA },
    );
  }

  async function guardarMoto() {
    if (!editando) return;
    try {
      const { id, ...datos } = editando;
      await guardar.mutateAsync({ id, datos });
      setEditando(null);
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    }
  }

  if (isLoading) return <Cargando />;

  return (
    <View style={{ flex: 1 }}>
      <Pantalla cargando={isRefetching} onRefrescar={refetch}>
        <Searchbar
          placeholder="Buscar por placa o dueño…"
          value={busqueda}
          onChangeText={setBusqueda}
          style={{ marginBottom: 12, backgroundColor: '#fff', borderRadius: 12 }}
          autoCapitalize="characters"
        />
        <Tarjeta titulo={`${lista.length} motos`}>
          {lista.length === 0 ? (
            <Vacio titulo="Sin motos" texto="Registre las motos para llevar su historial." />
          ) : (
            lista.map((m) => (
              <Fila
                key={m.id}
                titulo={m.placa ?? 'Sin placa'}
                subtitulo={[m.marca, m.linea, m.modelo].filter(Boolean).join(' · ') || undefined}
                detalle={m.cliente_nombre ?? 'Sin propietario'}
                onPress={() => abrir(m)}
                valor={m.cilindraje ?? ''}
              />
            ))
          )}
        </Tarjeta>
      </Pantalla>

      <FAB
        icon="plus"
        label="Moto"
        onPress={() => abrir()}
        style={{ position: 'absolute', right: 16, bottom: 20 }}
      />

      <Portal>
        <Dialog
          visible={!!editando}
          onDismiss={() => setEditando(null)}
          style={{ backgroundColor: '#fff', maxHeight: '85%' }}
        >
          <Dialog.Title>{editando?.id ? 'Editar moto' : 'Registrar moto'}</Dialog.Title>
          <Dialog.ScrollArea>
            <Pantalla sinPadding>
              {!!editando && (
                <View style={{ padding: 14 }}>
                  <CampoTexto
                    label="Placa"
                    value={editando.placa}
                    onChangeText={(t) => setEditando({ ...editando, placa: t.toUpperCase() })}
                    autoCapitalize="characters"
                  />
                  <Selector
                    etiqueta="Propietario"
                    valor={editando.cliente_id}
                    opciones={clientes}
                    texto={(c) => c.nombre}
                    onCambio={(v) => setEditando({ ...editando, cliente_id: v })}
                    textoVacio="Sin asignar"
                  />
                  <CampoTexto
                    label="Marca"
                    value={editando.marca}
                    onChangeText={(t) => setEditando({ ...editando, marca: t })}
                  />
                  <CampoTexto
                    label="Linea"
                    value={editando.linea}
                    onChangeText={(t) => setEditando({ ...editando, linea: t })}
                  />
                  <CampoTexto
                    label="Modelo (año)"
                    value={editando.modelo}
                    onChangeText={(t) => setEditando({ ...editando, modelo: t })}
                  />
                  <CampoTexto
                    label="Cilindraje"
                    value={editando.cilindraje}
                    onChangeText={(t) => setEditando({ ...editando, cilindraje: t })}
                  />
                  <CampoTexto
                    label="Color"
                    value={editando.color}
                    onChangeText={(t) => setEditando({ ...editando, color: t })}
                  />
                  {!!editando.id && (
                    <Button
                      textColor={colores.error}
                      onPress={() =>
                        Alert.alert('Borrar moto', '¿Continuar?', [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Borrar',
                            style: 'destructive',
                            onPress: async () => {
                              await borrar.mutateAsync(editando.id!);
                              setEditando(null);
                            },
                          },
                        ])
                      }
                    >
                      Borrar moto
                    </Button>
                  )}
                </View>
              )}
            </Pantalla>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditando(null)}>Cancelar</Button>
            <Button onPress={guardarMoto} loading={guardar.isPending}>
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
