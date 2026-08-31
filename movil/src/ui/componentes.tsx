/** Piezas de interfaz compartidas por todas las pantallas. */
import { ReactNode, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { ActivityIndicator, Button, Divider, Menu, Text, TextInput } from 'react-native-paper';

import { dinero } from '../lib/formato';
import { colores } from './tema';

// ------------------------------------------------------------------ pantalla
export function Pantalla({
  children,
  cargando,
  onRefrescar,
  sinPadding,
}: {
  children: ReactNode;
  cargando?: boolean;
  onRefrescar?: () => void;
  sinPadding?: boolean;
}) {
  return (
    <ScrollView
      style={e.fondo}
      contentContainerStyle={[e.contenido, sinPadding && { padding: 0 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefrescar ? (
          <RefreshControl
            refreshing={!!cargando}
            onRefresh={onRefrescar}
            colors={[colores.marca]}
          />
        ) : undefined
      }
    >
      {children}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <View style={e.centro}>
      <ActivityIndicator color={colores.marca} />
      <Text style={{ color: colores.suave, marginTop: 10 }}>{texto}</Text>
    </View>
  );
}

export function Vacio({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <View style={e.centro}>
      <Text variant="titleMedium" style={{ marginBottom: 4 }}>
        {titulo}
      </Text>
      {!!texto && <Text style={{ color: colores.suave, textAlign: 'center' }}>{texto}</Text>}
    </View>
  );
}

export function AvisoError({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar?: () => void;
}) {
  return (
    <View style={[e.tarjeta, { backgroundColor: colores.errorSuave, borderColor: '#fbd5d5' }]}>
      <Text style={{ color: colores.error, fontWeight: '600' }}>No se pudo cargar</Text>
      <Text style={{ color: colores.error, marginTop: 4 }}>{mensaje}</Text>
      {!!onReintentar && (
        <Button onPress={onReintentar} textColor={colores.error} style={{ marginTop: 6 }}>
          Reintentar
        </Button>
      )}
    </View>
  );
}

// -------------------------------------------------------------------- bloques
export function Tarjeta({
  titulo,
  accion,
  children,
  style,
}: {
  titulo?: string;
  accion?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[e.tarjeta, style]}>
      {!!titulo && (
        <View style={e.tarjetaEncabezado}>
          <Text variant="titleSmall" style={{ flex: 1 }}>
            {titulo}
          </Text>
          {accion}
        </View>
      )}
      {children}
    </View>
  );
}

export function Kpi({
  etiqueta,
  valor,
  nota,
  tono = 'normal',
  ancho,
  onPress,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  tono?: 'normal' | 'marca' | 'ok' | 'mal';
  ancho?: ViewStyle['width'];
  onPress?: () => void;
}) {
  const esMarca = tono === 'marca';
  const colorValor =
    tono === 'ok' ? colores.ok : tono === 'mal' ? colores.error : esMarca ? '#fff' : colores.texto;
  const Contenedor: typeof View | typeof TouchableOpacity = onPress ? TouchableOpacity : View;
  return (
    <Contenedor
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        e.kpi,
        { width: ancho ?? '48%' },
        esMarca && { backgroundColor: colores.marca, borderColor: colores.marca },
      ]}
    >
      <Text style={[e.kpiEtiqueta, esMarca && { color: '#cfe0ff' }]}>{etiqueta.toUpperCase()}</Text>
      <Text style={[e.kpiValor, { color: colorValor }]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      {!!nota && (
        <Text style={[e.kpiNota, esMarca && { color: '#cfe0ff' }]} numberOfLines={2}>
          {nota}
        </Text>
      )}
    </Contenedor>
  );
}

export function Rejilla({ children }: { children: ReactNode }) {
  return <View style={e.rejilla}>{children}</View>;
}

export function Fila({
  titulo,
  subtitulo,
  detalle,
  valor,
  valorSecundario,
  tonoValor,
  onPress,
  derecha,
}: {
  titulo: string;
  subtitulo?: string | null;
  detalle?: string | null;
  valor?: string;
  valorSecundario?: string | null;
  tonoValor?: 'normal' | 'ok' | 'mal' | 'alerta';
  onPress?: () => void;
  derecha?: ReactNode;
}) {
  const color =
    tonoValor === 'ok'
      ? colores.ok
      : tonoValor === 'mal'
        ? colores.error
        : tonoValor === 'alerta'
          ? colores.alerta
          : colores.texto;
  const Contenedor: typeof View | typeof TouchableOpacity = onPress ? TouchableOpacity : View;
  return (
    <>
      <Contenedor onPress={onPress} activeOpacity={0.6} style={e.fila}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={e.filaTitulo} numberOfLines={2}>
            {titulo}
          </Text>
          {!!subtitulo && (
            <Text style={e.filaSub} numberOfLines={1}>
              {subtitulo}
            </Text>
          )}
          {!!detalle && (
            <Text style={[e.filaSub, { color: colores.suave }]} numberOfLines={1}>
              {detalle}
            </Text>
          )}
        </View>
        {derecha ?? (
          <View style={{ alignItems: 'flex-end' }}>
            {!!valor && <Text style={[e.filaValor, { color }]}>{valor}</Text>}
            {!!valorSecundario && <Text style={e.filaSub}>{valorSecundario}</Text>}
          </View>
        )}
      </Contenedor>
      <Divider style={{ backgroundColor: colores.linea }} />
    </>
  );
}

export function Etiqueta({
  texto,
  tono = 'info',
}: {
  texto: string;
  tono?: 'info' | 'ok' | 'alerta' | 'mal' | 'gris';
}) {
  const paleta = {
    info: [colores.marcaSuave, colores.marca],
    ok: [colores.okSuave, colores.ok],
    alerta: [colores.alertaSuave, colores.alerta],
    mal: [colores.errorSuave, colores.error],
    gris: ['#eef1f6', colores.suave],
  }[tono];
  return (
    <View style={[e.etiqueta, { backgroundColor: paleta[0] }]}>
      <Text style={{ color: paleta[1], fontSize: 11, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

export function TotalesCaja({
  filas,
}: {
  filas: { nombre: string; valor: number; fuerte?: boolean }[];
}) {
  return (
    <View style={{ padding: 14 }}>
      {filas.map((f) => (
        <View
          key={f.nombre}
          style={[
            e.totalFila,
            f.fuerte && {
              borderTopWidth: 2,
              borderTopColor: colores.linea,
              marginTop: 6,
              paddingTop: 10,
            },
          ]}
        >
          <Text style={f.fuerte ? e.totalFuerte : { color: colores.suave }}>{f.nombre}</Text>
          <Text style={f.fuerte ? e.totalFuerte : { fontWeight: '600' }}>{dinero(f.valor)}</Text>
        </View>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ entradas
export function Selector<T extends { id: number }>({
  etiqueta,
  valor,
  opciones,
  texto,
  onCambio,
  permiteVacio = true,
  textoVacio = 'Sin seleccionar',
}: {
  etiqueta: string;
  valor: number | null;
  opciones: T[];
  texto: (item: T) => string;
  onCambio: (id: number | null) => void;
  permiteVacio?: boolean;
  textoVacio?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const elegido = opciones.find((o) => o.id === valor);
  return (
    <Menu
      visible={abierto}
      onDismiss={() => setAbierto(false)}
      anchorPosition="bottom"
      contentStyle={{ backgroundColor: '#fff', maxHeight: 420 }}
      anchor={
        <TouchableOpacity onPress={() => setAbierto(true)} activeOpacity={0.7}>
          <TextInput
            mode="outlined"
            label={etiqueta}
            editable={false}
            pointerEvents="none"
            value={elegido ? texto(elegido) : textoVacio}
            right={<TextInput.Icon icon="menu-down" onPress={() => setAbierto(true)} />}
            style={e.campo}
          />
        </TouchableOpacity>
      }
    >
      <ScrollView style={{ maxHeight: 400 }}>
        {permiteVacio && (
          <Menu.Item
            onPress={() => {
              onCambio(null);
              setAbierto(false);
            }}
            title={textoVacio}
          />
        )}
        {opciones.map((o) => (
          <Menu.Item
            key={o.id}
            onPress={() => {
              onCambio(o.id);
              setAbierto(false);
            }}
            title={texto(o)}
            titleStyle={{ fontSize: 14 }}
          />
        ))}
      </ScrollView>
    </Menu>
  );
}

export function Opciones<T extends string>({
  etiqueta,
  valor,
  opciones,
  onCambio,
}: {
  etiqueta?: string;
  valor: T;
  opciones: { valor: T; texto: string }[];
  onCambio: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      {!!etiqueta && <Text style={e.etiquetaCampo}>{etiqueta}</Text>}
      <View style={e.opciones}>
        {opciones.map((o) => {
          const activo = o.valor === valor;
          return (
            <TouchableOpacity
              key={o.valor}
              onPress={() => onCambio(o.valor)}
              activeOpacity={0.8}
              style={[
                e.opcion,
                activo && { backgroundColor: colores.marca, borderColor: colores.marca },
              ]}
            >
              <Text
                style={{
                  color: activo ? '#fff' : colores.texto,
                  fontWeight: activo ? '700' : '500',
                }}
              >
                {o.texto}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function CampoTexto(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput mode="outlined" dense style={[e.campo, props.style]} {...props} />;
}

export function CampoNumero(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      mode="outlined"
      dense
      keyboardType="numeric"
      style={[e.campo, props.style]}
      {...props}
    />
  );
}

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 12 },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 36 },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.linea,
    marginBottom: 12,
    overflow: 'hidden',
  },
  tarjetaEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colores.linea,
  },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  kpi: {
    backgroundColor: colores.superficie,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.linea,
    padding: 13,
    marginBottom: 10,
  },
  kpiEtiqueta: { fontSize: 10.5, color: colores.suave, letterSpacing: 0.6, fontWeight: '600' },
  kpiValor: { fontSize: 21, fontWeight: '800', marginTop: 4, letterSpacing: -0.4 },
  kpiNota: { fontSize: 11.5, color: colores.suave, marginTop: 2 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colores.superficie,
  },
  filaTitulo: { fontSize: 14.5, fontWeight: '600', color: colores.texto },
  filaSub: { fontSize: 12.5, color: colores.suave, marginTop: 2 },
  filaValor: { fontSize: 15, fontWeight: '700' },
  etiqueta: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start' },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalFuerte: { fontSize: 18, fontWeight: '800' },
  campo: { marginBottom: 12, backgroundColor: '#fff' },
  etiquetaCampo: { fontSize: 12, color: colores.suave, marginBottom: 6, fontWeight: '600' },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colores.linea,
    backgroundColor: '#fff',
  },
});

export const estilos = e;
