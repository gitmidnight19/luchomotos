# Contexto para agentes y nuevos desarrolladores

## El SDK está fijado en 54 a propósito

`package.json` apunta a `expo ~54.0.37` / `react-native 0.81.5`. **No lo suba.**

Expo Go de las tiendas va uno o dos SDK por detrás del publicado en npm. Con
SDK 56 o 57 la app falla al abrir con *"Project is incompatible with this
version of Expo Go"*. Para subir de SDK hay que dejar Expo Go y pasar a
development builds (EAS).

Al tocar dependencias nativas, usar siempre `npx expo install <paquete>` (elige
la versión compatible con el SDK) y verificar con `npx expo-doctor`.

## Peer dependencies

Hay un `.npmrc` con `legacy-peer-deps=true`. Es necesario: el propio Expo
arrastra un conflicto entre `react-dom` y la versión de `react` que fija el SDK,
y sin esa opción `expo install` falla.

## Los tipos de la API no se editan a mano

`src/api/tipos.ts` son alias sobre `src/api/openapi.d.ts`, que se genera del
esquema que publica el backend:

```bash
npm run api:types      # requiere el servidor corriendo en :8321
```

Si cambia `backend/app/schemas.py`, regenere. El CI compara el resultado contra
lo commiteado y falla si difieren.

## Antes de dar por terminado un cambio

```bash
npm run lint && npm run typecheck
```

## El diseño no se improvisa: está en `DESIGN/`

El canon visual vive en la raíz del repo, en dos capas autocontenidas:
`DESIGN/00-fundamentos.md` (marca, tipografía, movimiento, voz, gráficas) y
`DESIGN/20-mobile.md` (tema claro/oscuro, forma, dock, esqueletos, pantallas).
Antes de crear o cambiar una pantalla, léalas.

Las reglas que más se rompen:

1. **Ningún color se escribe en la pantalla.** Todo sale de `useTema().c` o de
   `useEstilos()`. El `StyleSheet.create` estático guarda medidas, no colores.
2. **`ActivityIndicator` está prohibido** en contenido. Se usa `<Cargando>` con
   el preset adecuado; el botón carga con su propio estado y el splash con
   `<Puntos>`.
3. **Los botones son píldoras y solo texto** (`<Boton>`), y hay **una sola
   acción con color por bloque**. La única pieza con icono junto al rótulo es
   la píldora flotante de acción.
4. **No hay barra superior.** Ninguna pantalla dibuja un header ni pone
   `title` / `headerShown` en el stack: el título se le pasa a `<Pantalla>`
   (`titulo`, `subtitulo`), el volver se pide con `atras` y la acción principal
   con `accion`. Nadie calcula su `paddingTop`.

Auditoría rápida antes de cerrar un cambio:

```bash
rg "ActivityIndicator" app src --glob "*.{tsx,ts}"
rg "#[0-9a-fA-F]{3,8}" app --glob "*.tsx"
rg "headerShown|setOptions|paddingTop" app --glob "*.tsx"
```

Si un valor cambia en el código, cambia en `DESIGN/` en el mismo commit.
