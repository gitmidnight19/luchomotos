/** Menu con el resto del sistema: compras, gastos, cartera, informes y ajustes. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useEstado } from '../../src/api/hooks';
import { dinero } from '../../src/lib/formato';
import { Etiqueta, Fila, Pantalla, Tarjeta } from '../../src/ui/componentes';
import { colores } from '../../src/ui/tema';

type Entrada = { titulo: string; detalle: string; icono: string; ruta: string };

const OPERACION: Entrada[] = [
  {
    titulo: 'Ventas',
    detalle: 'Facturas emitidas y anulaciones',
    icono: 'receipt',
    ruta: '/ventas',
  },
  {
    titulo: 'Compras',
    detalle: 'Facturas de proveedores',
    icono: 'truck-delivery-outline',
    ruta: '/compras',
  },
  {
    titulo: 'Gastos',
    detalle: 'Arriendo, servicios, nomina',
    icono: 'cash-minus',
    ruta: '/gastos',
  },
  {
    titulo: 'Cobros y pagos',
    detalle: 'Cartera y deudas',
    icono: 'handshake-outline',
    ruta: '/cartera',
  },
];

const CATALOGOS: Entrada[] = [
  {
    titulo: 'Clientes y proveedores',
    detalle: 'Directorio con saldos',
    icono: 'account-group-outline',
    ruta: '/clientes',
  },
  { titulo: 'Motos', detalle: 'Historial por placa', icono: 'motorbike', ruta: '/motos' },
  {
    titulo: 'Servicios',
    detalle: 'Lista de precios de mano de obra',
    icono: 'wrench-outline',
    ruta: '/servicios',
  },
];

const CONTABILIDAD: Entrada[] = [
  {
    titulo: 'Estado de resultados',
    detalle: 'Ingresos, costos y utilidad',
    icono: 'chart-line',
    ruta: '/informes/resultados',
  },
  {
    titulo: 'Balance general',
    detalle: 'Activos, pasivos y patrimonio',
    icono: 'scale-balance',
    ruta: '/informes/balance',
  },
  {
    titulo: 'Flujo de caja',
    detalle: 'Entradas y salidas de dinero',
    icono: 'water-outline',
    ruta: '/informes/flujo',
  },
  {
    titulo: 'Libro diario',
    detalle: 'Todos los asientos contables',
    icono: 'book-open-outline',
    ruta: '/informes/diario',
  },
];

export default function Mas() {
  const router = useRouter();
  const { data: estado, refetch, isRefetching } = useEstado();

  const seccion = (titulo: string, entradas: Entrada[]) => (
    <Tarjeta titulo={titulo}>
      {entradas.map((x) => (
        <Fila
          key={x.ruta}
          titulo={x.titulo}
          subtitulo={x.detalle}
          onPress={() => router.push(x.ruta)}
          derecha={<MaterialCommunityIcons name="chevron-right" size={22} color={colores.suave} />}
        />
      ))}
    </Tarjeta>
  );

  return (
    <Pantalla cargando={isRefetching} onRefrescar={refetch}>
      {!!estado && (
        <Tarjeta>
          <View style={{ padding: 16 }}>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>
              {estado.empresa}
            </Text>
            <Text style={{ color: colores.suave, marginTop: 2 }}>
              {estado.ventas} facturas · {estado.productos} repuestos
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
              <Etiqueta
                texto={
                  Math.abs(estado.cuadre) < 0.05
                    ? 'contabilidad cuadrada'
                    : `descuadre ${dinero(estado.cuadre)}`
                }
                tono={Math.abs(estado.cuadre) < 0.05 ? 'ok' : 'mal'}
              />
              <Etiqueta texto={`v${estado.version}`} tono="gris" />
            </View>
          </View>
        </Tarjeta>
      )}

      {seccion('Operacion', OPERACION)}
      {seccion('Catalogos', CATALOGOS)}
      {seccion('Contabilidad', CONTABILIDAD)}

      <Tarjeta titulo="Sistema">
        <Fila
          titulo="Configuracion"
          subtitulo="Datos del taller, IVA, servidor y respaldo"
          onPress={() => router.push('/config')}
          derecha={<MaterialCommunityIcons name="chevron-right" size={22} color={colores.suave} />}
        />
      </Tarjeta>
    </Pantalla>
  );
}
