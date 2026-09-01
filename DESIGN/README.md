# Sistema de diseño · Taller Motos Lucho

Dos capas. La segunda hereda de la primera y de nada más.

| Capa | Archivo | Qué manda |
|---|---|---|
| 1 · Fundamentos | [`00-fundamentos.md`](./00-fundamentos.md) | Marca, color, tipografía, movimiento, voz, reglas de dato. **Sin plataforma.** |
| 2 · App móvil | [`20-mobile.md`](./20-mobile.md) | Canon nativo: tema claro/oscuro, dock flotante, safe areas, esqueletos. |

No hay capa de panel web: el producto es la app (`movil/`) contra una API
FastAPI (`backend/`). Si algún día hay panel, se escribe como capa hermana —
**nunca** heredando de la capa 2: los componentes de Tailwind y los de React
Native no se comparten. Lo común vive en la capa 1.

## Cómo usarlo

- Pantalla nueva → capas 1 + 2.
- Cada capa es **autocontenida**: trae los valores, no punteros al código. Se le
  puede pasar a alguien —o a otra IA— sin acceso al repo.

## La regla de gobierno

El riesgo de un sistema documentado no es que falte documentación: es la
**deriva**, dos documentos que dicen cosas distintas del mismo rojo. Por eso:

- Un token se define **una vez**, en la capa 1. La capa 2 dice cómo se aplica,
  no cuál es.
- Si un valor cambia en el código, cambia aquí en el mismo commit.
- Las divergencias conocidas se **anotan**, no se disimulan.

## Origen

Adaptado del sistema de diseño de Red de Marcas. La estructura, los principios
de UX, el movimiento, la voz y las reglas de gráficas son los mismos. Lo que
cambia es la identidad: aquí la marca es **Taller Motos Lucho** y la paleta es
rojo · negro · azul, tomada del logo (`movil/assets/logo.jpeg`).
