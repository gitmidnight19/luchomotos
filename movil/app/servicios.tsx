/** Lista de precios de la mano de obra del taller. */
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { useBorrarServicio, useGuardarServicio, useServicios } from '../src/api/hooks';
import type { Servicio } from '../src/api/tipos';
import { aCentavos, aNumero, dinero, enPesos } from '../src/lib/formato';
import {
  CampoNumero,
  CampoTexto,
  Cargando,
  Fila,
  Pantalla,
  Tarjeta,
  Vacio,
} from '../src/ui/componentes';
import { useTema } from '../src/ui/temaProveedor';

const VACIO = { codigo: '', nombre: '', precio: '0', duracion_min: '0' };

export default function Servicios() {
  const { c } = useTema();
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
            precio: String(enPesos(s.precio)),
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
          precio: aCentavos(datos.precio),
          duracion_min: Math.round(aNumero(datos.duracion_min)),
          activo: true,
        },
      });
      setEditando(null);
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    }
  }

  if (isLoading)
    return (
      <Pantalla titulo="Servicios" atras>
        <Cargando />
      </Pantalla>
    );

  return (
    <Pantalla
      titulo="Servicios"
      subtitulo="Lista de precios de mano de obra"
      atras
      cargando={isRefetching}
      onRefrescar={refetch}
      accion={{ rotulo: 'Servicio', onPress: () => abrir() }}
    >
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
      <Portal>
        <Dialog
          visible={!!editando}
          onDismiss={() => setEditando(null)}
          style={{ backgroundColor: c.superficie }}
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
                    textColor={c.peligro}
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
    </Pantalla>
  );
}
