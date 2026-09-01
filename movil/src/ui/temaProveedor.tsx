/**
 * Modo claro / oscuro / sistema, persistido, y el acceso a la paleta activa.
 *
 * Regla dura del canon (DESIGN/20-mobile.md §1): ninguna pantalla escribe un
 * color. Todas lo piden aqui.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import {
  contexto as contextoSerie,
  type Modo,
  type Paleta,
  paletas,
  series,
  sombraMarca,
  temaPaper,
} from './tema';

export type Preferencia = Modo | 'sistema';

const LLAVE = '@tallerlucho:tema';

type Valor = {
  /** El modo que se esta pintando ahora. */
  modo: Modo;
  /** Lo que eligio la persona: puede ser «sistema». */
  preferencia: Preferencia;
  elegir: (p: Preferencia) => void;
  /** La paleta activa. Se usa como `c.texto`, `c.marca`… */
  c: Paleta;
  /** Los siete colores de serie del modo activo, en orden fijo. */
  serie: readonly string[];
  /** El gris de las series que no son el punto de la historia. */
  contexto: string;
  /** La sombra de marca del modo activo. */
  sombra: ReturnType<typeof sombraMarca>;
};

const Ctx = createContext<Valor | null>(null);

export function ProveedorTema({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const [preferencia, setPreferencia] = useState<Preferencia>('sistema');

  useEffect(() => {
    AsyncStorage.getItem(LLAVE)
      .then((v) => {
        if (v === 'claro' || v === 'oscuro' || v === 'sistema') setPreferencia(v);
      })
      .catch(() => {
        // Sin preferencia guardada se sigue el sistema. No hay nada que avisar.
      });
  }, []);

  const elegir = useCallback((p: Preferencia) => {
    setPreferencia(p);
    AsyncStorage.setItem(LLAVE, p).catch(() => {
      // Si no se pudo guardar, el modo igual cambia en esta sesion.
    });
  }, []);

  const modo: Modo =
    preferencia === 'sistema' ? (sistema === 'dark' ? 'oscuro' : 'claro') : preferencia;

  const valor = useMemo<Valor>(
    () => ({
      modo,
      preferencia,
      elegir,
      c: paletas[modo],
      serie: series[modo],
      contexto: contextoSerie[modo],
      sombra: sombraMarca(modo),
    }),
    [modo, preferencia, elegir],
  );

  return (
    <Ctx.Provider value={valor}>
      <PaperProvider theme={temaPaper(modo)}>
        {/* La barra de estado la sincroniza este componente, nunca las opciones del stack. */}
        <StatusBar style={modo === 'claro' ? 'dark' : 'light'} />
        {children}
      </PaperProvider>
    </Ctx.Provider>
  );
}

export function useTema(): Valor {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTema fuera de ProveedorTema');
  return v;
}

/**
 * Estilos que dependen del tema, memorizados por modo.
 *
 * Lo que no depende del tema (medidas, flex, radios) sigue en el
 * `StyleSheet.create` estatico al pie del archivo.
 */
export function useEstilos<T>(construir: (c: Paleta) => T): T {
  const { c, modo } = useTema();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => construir(c), [modo]);
}
