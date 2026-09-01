/** Configuracion: datos del taller, parametros contables y servidor. */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { olvidarServidor, servidorActual, servidorEsPorDefecto } from '../src/api/cliente';
import {
  useCargarDemo,
  useConfig,
  useEstado,
  useGuardarConfig,
  useLimpiarDatos,
} from '../src/api/hooks';
import { configurarFormato, dinero } from '../src/lib/formato';
import {
  Boton,
  CampoNumero,
  CampoTexto,
  Cargando,
  Etiqueta,
  Fila,
  Opciones,
  Pantalla,
  Tarjeta,
} from '../src/ui/componentes';
import type { Preferencia } from '../src/ui/temaProveedor';
import { useTema } from '../src/ui/temaProveedor';

export default function Configuracion() {
  const { c, preferencia, elegir } = useTema();
  const { data, isLoading, refetch, isRefetching } = useConfig();
  const { data: estado } = useEstado();
  const guardar = useGuardarConfig();
  const demo = useCargarDemo();
  const limpiar = useLimpiarDatos();
  const router = useRouter();

  const [valores, setValores] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) setValores(data);
  }, [data]);

  if (isLoading || !data)
    return (
      <Pantalla titulo="Configuracion" atras>
        <Cargando />
      </Pantalla>
    );

  const campo = (clave: string) => valores[clave] ?? '';
  const cambiar = (clave: string) => (texto: string) =>
    setValores((v) => ({ ...v, [clave]: texto }));

  async function guardarTodo() {
    try {
      const guardado = await guardar.mutateAsync(valores);
      configurarFormato(guardado.moneda, guardado.decimales);
      Alert.alert('Configuracion guardada');
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    }
  }

  function cambiarServidor() {
    Alert.alert('Cambiar de servidor', 'Tendra que escribir la direccion de nuevo. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cambiar',
        onPress: async () => {
          await olvidarServidor();
          router.replace('/conexion');
        },
      },
    ]);
  }

  function cargarEjemplo() {
    Alert.alert(
      'Cargar datos de ejemplo',
      'Se generan 3 meses de operacion simulada. Solo funciona si la base esta vacia.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cargar',
          onPress: async () => {
            try {
              await demo.mutateAsync();
              Alert.alert('Datos cargados', 'Ya puede explorar el sistema con informacion real.');
            } catch (e) {
              Alert.alert('No se pudo cargar', (e as Error).message);
            }
          },
        },
      ],
    );
  }

  function borrarTodo() {
    Alert.alert(
      'Borrar todos los movimientos',
      'Se borran ventas, compras, gastos, productos y clientes. El plan de cuentas se conserva y se guarda una copia de seguridad antes de borrar. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: async () => {
            try {
              await limpiar.mutateAsync();
              Alert.alert('Base limpia', 'El sistema quedo como recien instalado.');
            } catch (e) {
              Alert.alert('No se pudo borrar', (e as Error).message);
            }
          },
        },
      ],
    );
  }

  return (
    <Pantalla
      titulo="Configuracion"
      subtitulo="Apariencia, datos del taller y servidor"
      atras
      cargando={isRefetching}
      onRefrescar={refetch}
    >
      <Tarjeta titulo="Apariencia">
        <View style={{ padding: 14, paddingBottom: 2 }}>
          <Opciones<Preferencia>
            valor={preferencia}
            opciones={[
              { valor: 'sistema', texto: 'Sistema' },
              { valor: 'claro', texto: 'Claro' },
              { valor: 'oscuro', texto: 'Oscuro' },
            ]}
            onCambio={elegir}
          />
          <Text style={{ color: c.suave, marginBottom: 12, fontSize: 12.5 }}>
            En «Sistema» sigue lo que tenga configurado el telefono.
          </Text>
        </View>
      </Tarjeta>

      <Tarjeta titulo="Datos del taller">
        <View style={{ padding: 14, paddingBottom: 2 }}>
          <CampoTexto
            label="Nombre del taller"
            value={campo('empresa')}
            onChangeText={cambiar('empresa')}
          />
          <CampoTexto
            label="NIT / identificacion"
            value={campo('nit')}
            onChangeText={cambiar('nit')}
          />
          <CampoTexto
            label="Telefono"
            value={campo('telefono')}
            onChangeText={cambiar('telefono')}
            keyboardType="phone-pad"
          />
          <CampoTexto
            label="Direccion"
            value={campo('direccion')}
            onChangeText={cambiar('direccion')}
          />
        </View>
      </Tarjeta>

      <Tarjeta titulo="Parametros contables">
        <View style={{ padding: 14, paddingBottom: 2 }}>
          <CampoTexto
            label="Simbolo de moneda"
            value={campo('moneda')}
            onChangeText={cambiar('moneda')}
          />
          <CampoNumero
            label="Decimales"
            value={campo('decimales')}
            onChangeText={cambiar('decimales')}
          />
          <CampoNumero
            label="IVA general %"
            value={campo('iva_pct')}
            onChangeText={cambiar('iva_pct')}
          />
          <Text style={{ color: c.suave, marginBottom: 12, fontSize: 12.5 }}>
            Viene en 19%. Cambielo al que aplique a su negocio, o pongalo en 0 si no es responsable
            de IVA. Cada repuesto y cada linea de la venta lo puede sobrescribir.
          </Text>
          <CampoTexto
            label="Prefijo de facturas"
            value={campo('prefijo_venta')}
            onChangeText={cambiar('prefijo_venta')}
          />
          <CampoTexto
            label="Prefijo de compras"
            value={campo('prefijo_compra')}
            onChangeText={cambiar('prefijo_compra')}
          />
          <CampoTexto
            label="Prefijo de ordenes"
            value={campo('prefijo_orden')}
            onChangeText={cambiar('prefijo_orden')}
          />
          <CampoTexto
            label="Inicio del ejercicio (AAAA-MM-DD)"
            value={campo('inicio_ejercicio')}
            onChangeText={cambiar('inicio_ejercicio')}
            autoCapitalize="none"
          />
        </View>
      </Tarjeta>

      <Button
        mode="contained"
        onPress={guardarTodo}
        loading={guardar.isPending}
        style={{ borderRadius: 10, marginBottom: 14 }}
        contentStyle={{ paddingVertical: 6 }}
      >
        Guardar configuracion
      </Button>

      <Tarjeta titulo="Servidor y datos">
        <Fila
          titulo="Servidor conectado"
          subtitulo={servidorActual() ?? 'Sin configurar'}
          detalle={servidorEsPorDefecto() ? 'Viene de movil/.env' : undefined}
          onPress={cambiarServidor}
          derecha={<Etiqueta texto="cambiar" tono="info" />}
        />
        <Fila
          titulo="Descargar copia de seguridad"
          subtitulo="Se guarda en la carpeta data/respaldos del PC"
          detalle="Desde el navegador del PC: /api/respaldo"
        />
        {!!estado && (
          <Fila
            titulo="Estado de la contabilidad"
            subtitulo={`${estado.ventas} facturas · ${estado.productos} repuestos`}
            derecha={
              <Etiqueta
                texto={Math.abs(estado.cuadre) < 0.05 ? 'cuadrada' : dinero(estado.cuadre)}
                tono={Math.abs(estado.cuadre) < 0.05 ? 'ok' : 'mal'}
              />
            }
          />
        )}
      </Tarjeta>

      <Tarjeta titulo="Datos de prueba">
        <View style={{ padding: 14, gap: 8 }}>
          <Text style={{ color: c.suave, fontSize: 13 }}>
            Para conocer el sistema puede cargar 3 meses de operacion simulada, y despues dejar la
            base limpia para empezar con la informacion real del taller.
          </Text>
          <Boton
            titulo="Cargar datos de ejemplo"
            tono="suave"
            onPress={cargarEjemplo}
            cargando={demo.isPending}
          />
          <Boton
            titulo="Borrar todos los movimientos"
            tono="peligro"
            onPress={borrarTodo}
            cargando={limpiar.isPending}
          />
        </View>
      </Tarjeta>
    </Pantalla>
  );
}
