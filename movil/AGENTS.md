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
