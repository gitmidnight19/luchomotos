/**
 * Piezas de interfaz compartidas por todas las pantallas.
 *
 * Canon: DESIGN/20-mobile.md. Ninguna pieza escribe un hex: todo sale de
 * `useTema()`. El StyleSheet del pie solo guarda medidas, flex y radios.
 */
import { type ReactNode, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { Divider, Menu, Text, TextInput } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dinero } from '../lib/formato';
import { useSolapeDock } from './dock';
import { Esqueleto, type Preset } from './esqueleto';
import { Accion, type AccionFlotante, flotante, useHuecoSuperior, Volver } from './flotantes';
import { forma, type Paleta } from './tema';
import { useEstilos, useTema } from './temaProveedor';

// ------------------------------------------------------------------ pantalla
/**
 * La pantalla no calcula sus propios margenes: aplica las safe areas, el hueco
 * del volver flotante y la reserva del dock. Una pantalla que se los pone a
 * mano se desalinea en cuanto cambia el telefono.
 *
 * No hay barra superior (DESIGN/20-mobile.md §3): el titulo va en el lienzo y
 * se va con el scroll; volver y la accion principal flotan sobre el contenido.
 */
export function Pantalla({
  children,
  titulo,
  subtitulo,
  atras,
  accion,
  cargando,
  onRefrescar,
  incrustada,
  dock,
}: {
  children: ReactNode;
  /** Titulo grande en el lienzo. No es una barra: se va con el scroll. */
  titulo?: string;
  subtitulo?: string;
  /** Pantalla apilada: el volver flota, en vidrio, sobre el contenido. */
  atras?: boolean;
  /** La accion principal, en pildora flotante al alcance del pulgar. */
  accion?: AccionFlotante;
  cargando?: boolean;
  onRefrescar?: () => void;
  /** Dentro de un dialogo: sin margenes, sin safe areas y sin flotantes. */
  incrustada?: boolean;
  /** Solo las pantallas de pestana reservan el alto del dock flotante. */
  dock?: boolean;
}) {
  const { c } = useTema();
  const solape = useSolapeDock();
  const inset = useSafeAreaInsets();
  const arriba = useHuecoSuperior(atras);
  const piso = dock ? solape : Math.max(inset.bottom, 16) + 16;
  const abajo = piso + (accion ? flotante.accion + flotante.hueco : 0);

  const lienzo = (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.fondo }}
      contentContainerStyle={{
        padding: incrustada ? 0 : 12,
        paddingTop: incrustada ? 0 : arriba,
        paddingBottom: incrustada ? 8 : abajo,
      }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefrescar ? (
          <RefreshControl
            refreshing={!!cargando}
            onRefresh={onRefrescar}
            colors={[c.marca]}
            tintColor={c.marca}
            progressViewOffset={arriba}
          />
        ) : undefined
      }
    >
      {!incrustada && !!titulo && <Titular titulo={titulo} subtitulo={subtitulo} />}
      {children}
    </ScrollView>
  );

  if (incrustada) return lienzo;

  return (
    <View style={{ flex: 1, backgroundColor: c.fondo }}>
      {lienzo}
      {!!atras && <Volver />}
      {!!accion && <Accion {...accion} dock={dock} />}
    </View>
  );
}

/**
 * El titulo de la pantalla, en el lienzo. Dice donde esta uno al llegar y deja
 * la parte de arriba limpia en cuanto se empieza a leer.
 */
function Titular({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  const { c } = useTema();
  return (
    <Animated.View entering={FadeInDown.duration(380)} style={e.titular}>
      <Text style={[e.titulo, { color: c.texto }]}>{titulo}</Text>
      {!!subtitulo && <Text style={[e.subtitulo, { color: c.suave }]}>{subtitulo}</Text>}
    </Animated.View>
  );
}

/** Las secciones entran una detras de otra: la pantalla se arma sola. */
export function Seccion({ children, orden = 0 }: { children: ReactNode; orden?: number }) {
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(orden * 70)}>{children}</Animated.View>
  );
}

/**
 * Carga inicial de contenido. Es un esqueleto, no un spinner: el canon prohibe
 * `ActivityIndicator` en secciones de contenido.
 */
export function Cargando({ preset = 'lista', filas }: { preset?: Preset; filas?: number }) {
  return <Esqueleto preset={preset} filas={filas} />;
}

/** El vacio dice que falta y quien lo llena, no «sin datos». */
export function Vacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto?: string;
  accion?: ReactNode;
}) {
  const { c } = useTema();
  return (
    <View style={e.centro}>
      <Text variant="titleMedium" style={{ marginBottom: 4, textAlign: 'center' }}>
        {titulo}
      </Text>
      {!!texto && <Text style={{ color: c.suave, textAlign: 'center' }}>{texto}</Text>}
      {!!accion && <View style={{ marginTop: 16 }}>{accion}</View>}
    </View>
  );
}

/** El error dice que no se pudo hacer y que hacer ahora. El detalle va al log. */
export function AvisoError({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar?: () => void;
}) {
  const { c } = useTema();
  return (
    <View style={[e.tarjeta, { backgroundColor: c.peligroSuave, borderColor: c.peligro }]}>
      <View style={{ padding: forma.relleno }}>
        <Text style={{ color: c.peligro, fontWeight: '700' }}>No se pudo cargar</Text>
        <Text style={{ color: c.peligro, marginTop: 4 }}>{mensaje}</Text>
        {!!onReintentar && (
          <Boton
            titulo="Reintentar"
            onPress={onReintentar}
            tono="peligro"
            style={{ marginTop: 12 }}
          />
        )}
      </View>
    </View>
  );
}

// -------------------------------------------------------------------- boton
/** Pildora, solo texto. Un bloque tiene una sola accion con color. */
export function Boton({
  titulo,
  onPress,
  tono = 'marca',
  cargando,
  deshabilitado,
  style,
}: {
  titulo: string;
  onPress?: () => void;
  tono?: 'marca' | 'suave' | 'peligro';
  cargando?: boolean;
  deshabilitado?: boolean;
  style?: ViewStyle;
}) {
  const { c, sombra } = useTema();

  if (cargando)
    return (
      <View style={style}>
        <Esqueleto preset="boton" />
      </View>
    );

  const relleno = tono === 'marca' ? c.marca : tono === 'peligro' ? c.peligro : 'transparent';
  const tinta = tono === 'suave' ? c.texto : c.sobreMarca;
  const inerte = deshabilitado || !onPress;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inerte}
      style={({ pressed }) => [
        e.boton,
        { backgroundColor: relleno, opacity: inerte ? 0.45 : pressed ? 0.85 : 1 },
        tono === 'suave' && { borderWidth: 1, borderColor: c.linea, backgroundColor: c.superficie },
        tono === 'marca' && !inerte && sombra,
        style,
      ]}
    >
      <Text style={[e.botonTexto, { color: tinta }]}>{titulo}</Text>
    </Pressable>
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
  const { c } = useTema();
  return (
    <View style={[e.tarjeta, { backgroundColor: c.tarjeta, borderColor: c.linea }, style]}>
      {!!titulo && (
        <View style={[e.tarjetaEncabezado, { borderBottomColor: c.linea }]}>
          <Text style={[e.tituloTarjeta, { color: c.texto }]}>{titulo}</Text>
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
  const { c, sombra } = useTema();
  const esMarca = tono === 'marca';
  const colorValor =
    tono === 'ok' ? c.bien : tono === 'mal' ? c.peligro : esMarca ? c.sobreMarca : c.texto;
  const colorApoyo = esMarca ? 'rgba(255,255,255,.78)' : c.suave;
  const Contenedor: typeof View | typeof TouchableOpacity = onPress ? TouchableOpacity : View;

  return (
    <Contenedor
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        e.kpi,
        { width: ancho ?? '48%', backgroundColor: c.tarjeta, borderColor: c.linea },
        esMarca && { backgroundColor: c.marca, borderColor: c.marca, ...sombra },
      ]}
    >
      <Text style={[e.kpiEtiqueta, { color: colorApoyo }]}>{etiqueta.toUpperCase()}</Text>
      <Text style={[e.kpiValor, { color: colorValor }]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      {!!nota && (
        <Text style={[e.kpiNota, { color: colorApoyo }]} numberOfLines={2}>
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
  const { c } = useTema();
  const color =
    tonoValor === 'ok'
      ? c.bien
      : tonoValor === 'mal'
        ? c.peligro
        : tonoValor === 'alerta'
          ? c.atencion
          : c.texto;
  const Contenedor: typeof View | typeof TouchableOpacity = onPress ? TouchableOpacity : View;

  return (
    <>
      <Contenedor onPress={onPress} activeOpacity={0.6} style={e.fila}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[e.filaTitulo, { color: c.texto }]} numberOfLines={2}>
            {titulo}
          </Text>
          {!!subtitulo && (
            <Text style={[e.filaSub, { color: c.suave }]} numberOfLines={1}>
              {subtitulo}
            </Text>
          )}
          {!!detalle && (
            <Text style={[e.filaSub, { color: c.tenue }]} numberOfLines={1}>
              {detalle}
            </Text>
          )}
        </View>
        {derecha ?? (
          <View style={{ alignItems: 'flex-end' }}>
            {!!valor && <Text style={[e.filaValor, { color }]}>{valor}</Text>}
            {!!valorSecundario && (
              <Text style={[e.filaSub, { color: c.suave }]}>{valorSecundario}</Text>
            )}
          </View>
        )}
      </Contenedor>
      <Divider style={{ backgroundColor: c.linea }} />
    </>
  );
}

/**
 * Estado en dos presentaciones: suave para lo que matiza, solida para lo que
 * hay que ver de lejos. El color nunca va solo: siempre lleva su rotulo.
 */
export function Etiqueta({
  texto,
  tono = 'info',
  solida,
}: {
  texto: string;
  tono?: 'info' | 'ok' | 'alerta' | 'mal' | 'gris' | 'marca';
  solida?: boolean;
}) {
  const { c } = useTema();
  const par: Record<string, [string, string]> = {
    info: [c.acentoSuave, c.acento],
    ok: [c.bienSuave, c.bien],
    alerta: [c.atencionSuave, c.atencion],
    mal: [c.peligroSuave, c.peligro],
    marca: [c.marcaSuave, c.marca],
    gris: [c.campo, c.suave],
  };
  const [lavado, fuerte] = par[tono];

  return (
    <View style={[e.etiqueta, { backgroundColor: solida ? fuerte : lavado }]}>
      <Text style={[e.etiquetaTexto, { color: solida ? c.sobreMarca : fuerte }]}>{texto}</Text>
    </View>
  );
}

export function TotalesCaja({
  filas,
}: {
  filas: { nombre: string; valor: number; fuerte?: boolean }[];
}) {
  const { c } = useTema();
  return (
    <View style={{ padding: forma.relleno }}>
      {filas.map((f) => (
        <View
          key={f.nombre}
          style={[
            e.totalFila,
            f.fuerte && {
              borderTopWidth: 2,
              borderTopColor: c.linea,
              marginTop: 6,
              paddingTop: 10,
            },
          ]}
        >
          <Text style={f.fuerte ? [e.totalFuerte, { color: c.texto }] : { color: c.suave }}>
            {f.nombre}
          </Text>
          <Text
            style={
              f.fuerte ? [e.totalFuerte, { color: c.texto }] : { fontWeight: '600', color: c.texto }
            }
          >
            {dinero(f.valor)}
          </Text>
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
  const { c } = useTema();
  const [abierto, setAbierto] = useState(false);
  const elegido = opciones.find((o) => o.id === valor);

  return (
    <Menu
      visible={abierto}
      onDismiss={() => setAbierto(false)}
      anchorPosition="bottom"
      // En Android, sin forzar el fondo, el menu sale claro sobre tema oscuro.
      contentStyle={{ backgroundColor: c.superficie, maxHeight: 420 }}
      anchor={
        <TouchableOpacity onPress={() => setAbierto(true)} activeOpacity={0.7}>
          <TextInput
            mode="outlined"
            label={etiqueta}
            editable={false}
            pointerEvents="none"
            value={elegido ? texto(elegido) : textoVacio}
            right={<TextInput.Icon icon="menu-down" onPress={() => setAbierto(true)} />}
            style={{ marginBottom: 12, backgroundColor: c.superficie }}
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
            titleStyle={{ color: c.texto, fontSize: 14 }}
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
            titleStyle={{ color: c.texto, fontSize: 14 }}
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
  const { c } = useTema();
  return (
    <View style={{ marginBottom: 12 }}>
      {!!etiqueta && <Text style={[e.etiquetaCampo, { color: c.suave }]}>{etiqueta}</Text>}
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
                { backgroundColor: c.superficie, borderColor: c.linea },
                activo && { backgroundColor: c.marca, borderColor: c.marca },
              ]}
            >
              <Text
                style={{
                  color: activo ? c.sobreMarca : c.texto,
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
  const est = useEstilos(campoTema);
  return <TextInput mode="outlined" dense style={[est.campo, props.style]} {...props} />;
}

export function CampoNumero(props: React.ComponentProps<typeof TextInput>) {
  const est = useEstilos(campoTema);
  return (
    <TextInput
      mode="outlined"
      dense
      keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
      style={[est.campo, props.style]}
      {...props}
    />
  );
}

const campoTema = (c: Paleta) =>
  StyleSheet.create({ campo: { marginBottom: 12, backgroundColor: c.superficie } });

const e = StyleSheet.create({
  titular: { marginBottom: 16, paddingHorizontal: 2 },
  titulo: { fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -0.8 },
  subtitulo: { fontSize: 13.5, marginTop: 3, lineHeight: 18 },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 36 },
  tarjeta: {
    borderRadius: forma.tarjeta,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  tarjetaEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: forma.rellenoFila,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tituloTarjeta: { flex: 1, fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  boton: {
    minHeight: forma.toque,
    paddingHorizontal: 22,
    borderRadius: forma.pildora,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  kpi: {
    borderRadius: forma.tarjeta,
    borderWidth: 1,
    padding: forma.rellenoFila,
    marginBottom: 10,
  },
  kpiEtiqueta: { fontSize: 11, letterSpacing: 0.6, fontWeight: '700' },
  kpiValor: {
    fontSize: 21,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  kpiNota: { fontSize: 11.5, marginTop: 2 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: forma.toque,
    paddingHorizontal: forma.rellenoFila,
    paddingVertical: 12,
  },
  filaTitulo: { fontSize: 14, fontWeight: '600' },
  filaSub: { fontSize: 12.5, marginTop: 2 },
  filaValor: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  etiqueta: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: forma.pildora,
    alignSelf: 'flex-start',
  },
  etiquetaTexto: { fontSize: 11, fontWeight: '700' },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  totalFuerte: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  etiquetaCampo: { fontSize: 12, marginBottom: 6, fontWeight: '600' },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: {
    minHeight: forma.toque,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: forma.pildora,
    borderWidth: 1,
  },
});
