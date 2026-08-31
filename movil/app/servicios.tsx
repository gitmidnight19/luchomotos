/** Lista de precios de la mano de obra del taller. */
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Dialog, FAB, Portal } from 'react-native-paper';

import { useBorrarServicio, useGuardarServicio, useServicios } from '../src/api/hooks';
import type { Servicio } from '../src/api/tipos';
import { aNumero, dinero } from '../src/lib/formato';
import {
  CampoNumero,
  CampoTexto,
  Cargando,
  Fila,
  Pantalla,
  Tarjeta,
  Vacio,
} from '../src/ui/componentes';
import { colores } from '../src/ui/tema';

const VACIO = { codigo: '', nombre: '', precio: '0', duracion_min: '0' };

export default function Servicios() {
  const { data = [], isLoading, isRefetching, refetch } = useServicios();
  const guardar = useGuardarServicio();
  const borrar = useBorrarServicio();
  const [editando, setEditando] = useState<(typeof VACIO & { id?: number }) | null>(null);

  function abrir(s?: Servicio) {
    setEditando(
      s
        ? {
            id: s.id,
            codigo: s.codigo ?? '',
            nombre: s.nombre,
            precio: String(s.precio),
            duracion_min: String(s.duracion_min ?? 0),
          }
        : { ...VACIO },
    );
  }

  async function guardarServicio() {
    if (!editando?.nombre.trim()) {
      Alert.alert('Falta el nombre del servicio');
      return;
    }
    try {
      const { id, ...datos } = editando;
      await guardar.mutateAsync({
        id,
        datos: {
          codigo: datos.codigo || null,
          nombre: datos.nombre.trim(),
          precio: aNumero(datos.precio),
          duracion_min: Math.round(aNumero(datos.duracion_min)),
          activo: true,
        },
      });
      setEditando(null);
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    }
  }

  if (isLoading) return <Cargando />;

  return (
    <View style={{ flex: 1 }}>
      <Pantalla cargando={isRefetching} onRefrescar={refetch}>
        <Tarjeta titulo={`${data.length} servicios`}>
          {data.length === 0 ? (
            <Vacio titulo="Sin servicios" texto="Defina los trabajos que ofrece el taller." />
          ) : (
            data.map((s) => (
              <Fila
                key={s.id}
                titulo={s.nombre}
                subtitulo={[s.codigo, s.duracion_min ? `${s.duracion_min} min` : null]
                  .filter(Boolean)
                  .join(' · ')}
                valor={dinero(s.precio)}
                onPress={() => abrir(s)}
              />
            ))
          )}
        </Tarjeta>
      </Pantalla>

      <FAB
        icon="plus"
        label="Servicio"
        onPress={() => abrir()}
        style={{ position: 'absolute', right: 16, bottom: 20 }}
      />

      <Portal>
        <Dialog
          visible={!!editando}
          onDismiss={() => setEditando(null)}
          style={{ backgroundColor: '#fff' }}
        >
          <Dialog.Title>{editando?.id ? 'Editar servicio' : 'Nuevo servicio'}</Dialog.Title>
          <Dialog.Content>
            {!!editando && (
              <>
                <CampoTexto
                  label="Nombre del servicio"
                  value={editando.nombre}
                  onChangeText={(t) => setEditando({ ...editando, nombre: t })}
                />
                <CampoTexto
                  label="Codigo"
                  value={editando.codigo}
                  onChangeText={(t) => setEditando({ ...editando, codigo: t })}
                  autoCapitalize="characters"
                />
                <CampoNumero
                  label="Precio"
                  value={editando.precio}
                  onChangeText={(t) => setEditando({ ...editando, precio: t })}
                />
                <CampoNumero
                  label="Duracion (minutos)"
                  value={editando.duracion_min}
                  onChangeText={(t) => setEditando({ ...editando, duracion_min: t })}
                />
                {!!editando.id && (
                  <Button
                    textColor={colores.error}
                    onPress={() =>
                      Alert.alert('Retirar servicio', '¿Continuar?', [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Retirar',
                          style: 'destructive',
                          onPress: async () => {
                            await borrar.mutateAsync(editando.id!);
                            setEditando(null);
                          },
                        },
                      ])
                    }
                  >
                    Retirar de la lista
                  </Button>
                )}
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditando(null)}>Cancelar</Button>
            <Button onPress={guardarServicio} loading={guardar.isPending}>
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
