# Capa 2 · App móvil (`movil/`)

Hereda [`00-fundamentos.md`](./00-fundamentos.md). Stack: Expo SDK 54 / React
Native 0.81, `expo-router`, `react-native-paper`, `expo-blur`,
`react-native-reanimated`, `react-native-safe-area-context`.

La app se usa **en el taller**: de pie, con una mano, con las manos sucias, con
sol de frente y a veces sin señal. Eso manda sobre la estética.

---

## 1 · Tema claro / oscuro

La app tiene los dos modos y el usuario elige: **claro · oscuro · sistema**, en
*Más → Configuración → Apariencia*, persistido en `@tallerlucho:tema`.

Regla dura: **ningún color de UI se escribe en el archivo de la pantalla.** Sale
siempre de la paleta activa (`useTema().c` / `useEstilos()`). El
`StyleSheet.create` estático al pie del archivo guarda solo lo que no depende
del tema: medidas, flex, radios.

| Token | Claro | Oscuro |
|---|---|---|
| `texto` | `#1C1C1E` | `#F2F2F7` |
| `suave` | `#6B6B6F` | `#ABABAF` |
| `tenue` | `#AEAEB2` | `#636366` |
| `fondo` | `#F2F2F7` | `#0D0D0F` |
| `superficie` | `#FFFFFF` | `#1C1C1E` |
| `tarjeta` | `#FFFFFF` | `#242428` |
| `campo` | `#F2F2F7` | `#2C2C2E` |
| `velo` | `rgba(0,0,0,.45)` | `rgba(0,0,0,.72)` |
| `linea` / `separador` | `#E5E5EA` / `#D1D1D6` | `#38383A` / `#2C2C2E` |
| `marca` (identidad) | `#B11212` | `#E5484D` |
| `marcaSuave` | `#FDECEC` | `#3A1517` |
| `acento` (azul) | `#2A78D6` | `#5598E7` |
| `acentoSuave` | `#EAF2FD` | `#132A45` |
| `tinta` (negro de marca) | `#0B0B0B` | `#0B0B0B` |
| `icono` / `dockInactivo` | `#8E8E93` | `#8D8D93` |
| `dockActivo` | `#B11212` | `#E5484D` |
| `dockFondo` | `rgba(255,255,255,.85)` | `rgba(18,18,20,.88)` |
| `peligro` / `bien` / `atencion` / `info` | `#FF3B30` / `#34C759` / `#FF9500` / `#007AFF` | `#FF453A` / `#32D74B` / `#FFD60A` / `#0A84FF` |
| `brilloBase` / `brilloAlto` | `#E8E8ED` / `#F5F5FA` | `#2C2C2E` / `#3A3A3C` |

Notas que no son negociables:

- **En oscuro el acento funcional es azul, pero la marca sigue siendo roja.** El
  botón primario, el dock activo y el splash van en el rojo elevado `#E5484D`.
- Los estados usan los colores del sistema operativo, no una paleta propia: la
  app tiene que sentirse nativa.
- **La paleta de gráficas de la capa 1 está validada solo contra blanco.** En
  oscuro se usa la fila re-escalonada, y esa fila está pendiente de validar.

### Excepciones que pueden quedar fijas

Splash nativo · el blanco del `#fff` sobre superficies de marca sólidas · el
recuadro blanco del logo mientras no haya PNG transparente.

---

## 2 · Forma

| Pieza | Valor |
|---|---|
| Panel de vidrio (dock) | radio **24** |
| Volver flotante | círculo **44**, vidrio `dockFondo`, sombra de marca |
| Píldora de acción flotante | alto **52**, radio 999, `marca` sólido, icono + rótulo |
| Tarjeta de contenido | radio **16** (14 y 12 en piezas anidadas) |
| Píldora | radio **999** |
| Icono en círculo de marca | 28 / 32 / 40 / 56 px, icono 15 / 17 / 22 / 28, fondo `marca` sólido |
| Relleno de tarjeta | 16 px (14 en filas de lista) |
| Área de toque | **44 px mínimo**, sin excepción |

**Los botones van en píldora** (`radio 999`), no en rectángulo redondeado, y
llevan **solo texto**: sin icono al lado de la etiqueta. La única excepción es
la píldora flotante de acción: sin barra superior es el único ancla de la
acción de la pantalla, y el icono la hace legible de un vistazo con el pulgar
encima.

**Sombra de marca** (dock, tarjeta activa, botón primario): sin borde, color
`#B11212`, offset `0/5`, opacidad `.2`, radio 12, `elevation: 5`. La sombra tiñe
de rojo, no de negro. En modo oscuro la opacidad baja a `.35` y el color pasa a
`#E5484D`, porque una sombra negra sobre negro no existe.

**Vidrio**: en Android `BlurView` sin `experimentalBlurMethod` solo dibuja un
velo semitransparente — hay que activar `dimezisBlurView` con
`blurReductionFactor: 3`. La intensidad de iOS se multiplica ×1.4 en Android
para que se vea igual.

---

## 3 · Navegación

### Dock inferior flotante

Cinco destinos: **Panel · Vender · Órdenes · Inventario · Más**. Cinco es el
techo; un sexto destino va dentro de *Más*.

```
alto del cuerpo   = 12 (padding glass) × 2 + 60 (interior) = 84
píldora activa    52 de alto, se expande con el rótulo
icono             24
márgenes wrapper  14 horizontal · 10 superior
```

El **solape** que una pantalla debe reservar abajo es
`10 + 84 + max(safeArea.bottom, 12 iOS / 10 Android)`. Lo calcula
`useSolapeDock()`; no se escribe a mano: un número mágico local rompe en el
primer teléfono con otra barra de gestos.

### Sin barra superior

**Ninguna pantalla dibuja un header con su nombre.** Esa franja —44 px en iOS,
56 en Android— repetía en cada pantalla lo que el dock ya dice y le quitaba
altura al dato, que es lo que se viene a mirar. En su lugar:

- **El título vive en el lienzo**: grande (30 / 800 / `texto`), con subtítulo
  opcional en `suave`. Es contenido, no cromo: entra con la sección y **se va
  con el scroll**. No se vuelve pegajoso al subir.
- **Volver flota**: círculo de vidrio de 44 px arriba a la izquierda, en
  `dockFondo` con sombra de marca, sobre el contenido y siempre visible. Los
  gestos del sistema siguen intactos: deslizar en iOS, botón físico en Android.
- **La acción principal flota**: píldora de marca de 52 px abajo a la derecha,
  a la altura del pulgar. Una por pantalla; si hacen falta dos, la segunda va
  en el contenido.
- **Las pantallas de pestaña no titulan**: el rótulo del dock activo ya dice en
  qué sección se está.
- La barra de estado la sincroniza un componente global con el tema. **Nunca**
  `statusBarStyle` en las opciones del stack.

Nada de esto se escribe a mano en una pantalla: `<Pantalla>` recibe `titulo`,
`subtitulo`, `atras` y `accion`, y `useHuecoSuperior()` / `useSueloAccion()`
resuelven safe areas, hueco del volver y reserva del dock. Un `paddingTop`
local vuelve a meter el título bajo la muesca en el primer teléfono distinto.

### Entrada de sección

Las secciones entran con `FadeInDown` de **420 ms** y **70 ms** de escalonado
entre ellas. La pantalla se arma sola.

---

## 4 · Estados de carga

Sistema unificado. **`ActivityIndicator` está prohibido** en pantallas y
secciones de contenido.

| Qué está cargando | Qué se usa |
|---|---|
| Contenido: listas, detalle, informes, catálogos | `<Esqueleto preset="…" />` |
| Botón en envío | el propio botón en estado `cargando` |
| Splash y portón de conexión | `<Puntos />` |

Presets: `lista` · `tarjeta` · `panel` · `metricas` (rejilla 2×2) · `fila` ·
`campo` · `informe` · `boton`.

Reglas:

- **Esqueleto solo en la carga inicial.** En listas con *pull to refresh* manda
  el `RefreshControl` del sistema; no se reemplaza con esqueleto en cada tirón.
- La transición esqueleto → contenido **no puede mover el layout**: alturas
  parecidas.
- El brillo tiene que verse en los dos modos.

Auditoría:

```bash
rg "ActivityIndicator" movil/app movil/src --glob "*.{tsx,ts}"
```

Solo debe aparecer `src/ui/esqueleto.tsx` (los `Puntos`, que no lo usan) y nada
en `app/`.

---

## 5 · Pantallas

- **Las pantallas no calculan sus propios márgenes.** Usan `<Pantalla>`, que
  aplica safe areas, hueco del volver flotante y reserva del dock y de la
  píldora de acción.
- **Safe areas siempre.** Ningún control vive bajo el indicador de inicio.
- **Alcance del pulgar**: la acción principal va abajo, al alcance; lo
  destructivo, lejos de ella.
- **Sin hover.** Todo lo que en un panel se descubre con el mouse aquí va
  rotulado o no existe. La retroalimentación es el estado presionado.
- **Formularios**: un grupo por pantalla o por paso.
- **Modo avión mental**: el taller pierde señal. Todo lo que se envía dice si
  quedó en cola y qué falta para que salga; la pantalla de conexión explica en
  lenguaje de producto por qué no hay servidor.
- **Los pickers y menús de Android** llevan el color del texto forzado desde el
  tema; si no, en oscuro salen negros sobre negro.

---

## 6 · Checklist

- [ ] Ningún hex escrito en la pantalla: todo sale de la paleta activa.
- [ ] Se ve bien en claro **y** en oscuro, incluido el esqueleto.
- [ ] Nada bajo la muesca ni bajo la barra de gestos; el dock no tapa contenido.
- [ ] Todo lo tocable mide 44 px o más.
- [ ] Ningún `ActivityIndicator` fuera de las excepciones.
- [ ] La carga no mueve el layout al llegar el dato.
- [ ] Ninguna barra superior: el título va en el lienzo y se va con el scroll.
- [ ] El volver flota y no tapa nada que haya que leer o tocar.
- [ ] Botones en píldora y solo con texto, salvo la píldora flotante de acción.
- [ ] Está claro cuál es el siguiente paso — y el botón lo dice.
