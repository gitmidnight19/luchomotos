/** Pantalla de conexion: la app apunta al servidor que corre en el PC del taller. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { cargarServidor, guardarServidor, probarServidor } from '../src/api/cliente';
import { CampoTexto } from '../src/ui/componentes';
import { colores } from '../src/ui/tema';

export default function Conexion() {
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
      <ScrollView contentContainerStyle={e.contenedor} keyboardShouldPersistTaps="handled">
        <View style={e.icono}>
          <MaterialCommunityIcons name="lan-connect" size={34} color={colores.marca} />
        </View>
        <Text variant="headlineSmall" style={e.titulo}>
          Conectar con el taller
        </Text>
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

        <Button
          mode="contained"
          onPress={conectar}
          loading={probando}
          disabled={probando || !direccion.trim()}
          style={{ marginTop: 4, borderRadius: 10 }}
          contentStyle={{ paddingVertical: 6 }}
        >
          Conectar
        </Button>

        {!!mensaje && (
          <View
            style={[
              e.aviso,
              { backgroundColor: mensaje.ok ? colores.okSuave : colores.errorSuave },
            ]}
          >
            <Text style={{ color: mensaje.ok ? colores.ok : colores.error }}>{mensaje.texto}</Text>
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

const e = StyleSheet.create({
  contenedor: { padding: 22, paddingTop: 34, backgroundColor: colores.fondo, flexGrow: 1 },
  icono: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colores.marcaSuave,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  titulo: { fontWeight: '800', marginBottom: 8 },
  texto: { color: colores.suave, lineHeight: 21, marginBottom: 20 },
  codigo: { color: colores.marca, fontWeight: '700' },
  aviso: { padding: 13, borderRadius: 10, marginTop: 14 },
  ayuda: {
    marginTop: 28,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colores.linea,
  },
  ayudaTitulo: { fontWeight: '700', marginBottom: 8 },
  ayudaTexto: { color: colores.suave, lineHeight: 21, marginBottom: 3 },
});
