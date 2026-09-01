/** Pantalla de conexion: la app apunta al servidor que corre en el PC del taller. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cargarServidor, guardarServidor, probarServidor } from '../src/api/cliente';
import { Boton, CampoTexto } from '../src/ui/componentes';
import { forma, type Paleta } from '../src/ui/tema';
import { useEstilos, useTema } from '../src/ui/temaProveedor';

export default function Conexion() {
  const { c } = useTema();
  const e = useEstilos(estilos);
  const inset = useSafeAreaInsets();
  const [direccion, setDireccion] = useState('');
  const [probando, setProbando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const router = useRouter();
  const cliente = useQueryClient();

  useEffect(() => {
    cargarServidor().then((url) => url && setDireccion(url));
  }, []);

  async function conectar() {
    setProbando(true);
    setMensaje(null);
    const resultado = await probarServidor(direccion);
    setMensaje({ ok: resultado.ok, texto: resultado.mensaje });
    if (resultado.ok) {
      await guardarServidor(direccion);
      await cliente.invalidateQueries();
      setTimeout(() => router.replace('/'), 400);
    }
    setProbando(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          e.contenedor,
          // Sin barra superior: el porton pone su propio aire arriba.
          { paddingTop: inset.top + 24, paddingBottom: Math.max(inset.bottom, 16) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={e.icono}>
          <MaterialCommunityIcons name="lan-connect" size={28} color={c.sobreMarca} />
        </View>

        <Text style={e.titulo}>Conectar con el taller</Text>

        <Text style={e.texto}>
          En el computador del taller abra el servidor. La pantalla que aparece muestra una
          direccion como <Text style={e.codigo}>http://192.168.1.5:8321</Text>. Escribala aqui.
        </Text>

        <CampoTexto
          label="Direccion del servidor"
          placeholder="192.168.1.5:8321"
          value={direccion}
          onChangeText={setDireccion}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Boton
          titulo="Conectar"
          onPress={conectar}
          cargando={probando}
          deshabilitado={!direccion.trim()}
          style={{ marginTop: 4 }}
        />

        {!!mensaje && (
          <View style={[e.aviso, { backgroundColor: mensaje.ok ? c.bienSuave : c.peligroSuave }]}>
            <MaterialCommunityIcons
              name={mensaje.ok ? 'check-circle' : 'alert-circle'}
              size={18}
              color={mensaje.ok ? c.bien : c.peligro}
            />
            <Text style={{ color: mensaje.ok ? c.bien : c.peligro, flex: 1 }}>{mensaje.texto}</Text>
          </View>
        )}

        <View style={e.ayuda}>
          <Text style={e.ayudaTitulo}>Si no conecta</Text>
          <Text style={e.ayudaTexto}>1. El celular y el PC deben estar en la misma red WiFi.</Text>
          <Text style={e.ayudaTexto}>2. El servidor debe estar abierto en el computador.</Text>
          <Text style={e.ayudaTexto}>
            3. Si Windows pregunta por el firewall, permita el acceso en redes privadas.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = (c: Paleta) =>
  StyleSheet.create({
    contenedor: { padding: 22, backgroundColor: c.fondo, flexGrow: 1 },
    titulo: {
      fontSize: 28,
      lineHeight: 33,
      fontWeight: '800',
      letterSpacing: -0.7,
      color: c.texto,
      marginBottom: 10,
    },
    icono: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.marca,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    texto: { color: c.suave, lineHeight: 21, marginBottom: 20 },
    codigo: { color: c.marca, fontWeight: '700' },
    aviso: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 13,
      borderRadius: forma.interior,
      marginTop: 14,
    },
    ayuda: {
      marginTop: 28,
      padding: forma.relleno,
      borderRadius: forma.tarjeta,
      backgroundColor: c.tarjeta,
      borderWidth: 1,
      borderColor: c.linea,
    },
    ayudaTitulo: { fontWeight: '700', marginBottom: 8, color: c.texto },
    ayudaTexto: { color: c.suave, lineHeight: 21, marginBottom: 3 },
  });
