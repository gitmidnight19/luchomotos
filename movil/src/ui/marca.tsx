/**
 * Identidad de Taller Motos Lucho.
 *
 * Deuda abierta (DESIGN/00-fundamentos.md §2): el logo es un JPEG con fondo
 * blanco. Hasta que exista un PNG transparente se muestra dentro de una tarjeta
 * blanca, igual en los dos modos, para que el recuadro sea intencional y no un
 * defecto.
 */
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';

import { forma } from './tema';
import { useTema } from './temaProveedor';

const archivo = require('../../assets/logo.jpeg');

export function Logo({ ancho = 180, style }: { ancho?: number; style?: ViewStyle }) {
  const { sombra } = useTema();
  return (
    <View style={[e.marco, { width: ancho + 24 }, sombra, style]}>
      <Image
        source={archivo}
        style={{ width: ancho, height: ancho }}
        resizeMode="contain"
        accessibilityLabel="Taller Motos Lucho"
      />
    </View>
  );
}

/** El sello: logo pequeno con el nombre. Va en el splash y en la cabecera de Mas. */
export function Sello({ ancho = 132 }: { ancho?: number }) {
  const { c } = useTema();
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Logo ancho={ancho} />
      <Text style={[e.nombre, { color: c.texto }]}>Taller Motos Lucho</Text>
      <Text style={[e.pie, { color: c.suave }]}>Contabilidad del taller</Text>
    </View>
  );
}

const e = StyleSheet.create({
  marco: {
    backgroundColor: '#FFFFFF', // el logo trae fondo blanco; el marco lo asume
    borderRadius: forma.tarjeta,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  pie: { fontSize: 13 },
});
