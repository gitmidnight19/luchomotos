# Capa 1 · Fundamentos

Lo que no depende de la plataforma. No hay un solo componente aquí: si algo
depende de React Native, va en la capa 2.

---

## 1 · Principios

> **Buena UX = acción.** Una pantalla limpia que no empuja a nada está a medias.
> En cada etapa tiene que estar claro qué sigue y qué falta para lograrlo.

- **Orden = prioridad.** Lo que mueve a actuar va arriba.
- **Una sola acción con color por bloque.** El resto queda en segundo plano o
  dentro de un menú.
- **El vacío dice qué falta**, no «sin datos»: «Todavía no hay ventas de hoy.»
- **El error dice qué no se pudo hacer y qué hacer ahora**, en lenguaje de
  taller. El detalle técnico va al log.
- **Quitar el bloqueo, no exigirlo.** Ningún dato que el mecánico quizá no tenga
  a mano puede frenar un registro; se completa después. Una orden se abre con la
  placa de la moto aunque falte el documento del cliente.
- **Micro-compromisos.** Un formulario largo se parte en grupos pequeños y se
  muestra uno a la vez.
- **Cerrar con logro y encadenar.** Una venta registrada no termina en un toast:
  confirma el total y ofrece el siguiente paso (cobrar, imprimir, nueva venta).
  Nunca redirigir sin preguntar.
- **Ayuda en el momento, no tutorial al entrar.** La explicación aparece donde
  está el control y cuando hace falta.
- **Un patrón que hay que explicar dos veces está mal diseñado.**

---

## 2 · Marca

La identidad sale del logo: **moto en negro, llave en rojo, palabra LUCHO en
negro**. El rojo es identidad, no un color de dato: marca la navegación y la
acción principal, no codifica magnitud.

| Color | Valor | Papel |
|---|---|---|
| Rojo marca | `#B11212` | Identidad y acción principal. Header, botón primario, pestaña activa, sello. |
| Negro | `#0B0B0B` | Tinta y superficies fuertes. El negro del logo, no un gris oscuro. |
| Azul | `#2A78D6` | Acento secundario: información, vínculos, segunda serie de gráficas. |

**El azul no compite con el rojo.** En un bloque solo hay una acción con color y
esa es roja. El azul aparece donde el rojo significaría «actúa aquí» y no es
cierto: un dato informativo, un vínculo a un detalle, la serie 2 de un gráfico.

### El rojo en modo oscuro

Sobre `#0D0D0F` el `#B11212` pierde legibilidad como acento. En oscuro el acento
funcional pasa al azul `#5598E7`, y el rojo se **eleva** a `#E5484D` para lo que
es identidad: splash, dock activo, sello. Un recorrido enteramente azul no es el
recorrido de Taller Motos Lucho.

### Deuda abierta

El logo es un JPEG con fondo blanco (`movil/assets/logo.jpeg`). Sobre superficie
oscura se nota el recuadro. Hace falta una versión SVG o PNG con transparencia y
una variante monocroma blanca para el header rojo. Mientras tanto el logo se
muestra dentro de una tarjeta blanca en los dos temas.

---

## 3 · Escala tipográfica

Valores de app (lectura a distancia de brazo).

| Rol | Tamaño | Notas |
|---|---|---|
| Cuerpo, filas de lista | 14 px | |
| Título de tarjeta | 14 px semibold | `tracking` negativo |
| Título de sección | 13 px | **mayúsculas**, `tracking` amplio, gris medio |
| Etiqueta de métrica | 11 px | mayúsculas, gris claro |
| Cifra de métrica | 21 px | peso 800, `tracking` −0.4 |
| Título de pantalla | 18-20 px semibold | |

- **Cifras siempre tabulares** y alineadas a la derecha: si bailan al
  actualizarse, la columna deja de leerse. En un taller la columna de pesos es
  lo primero que se mira.
- **Un título por sección.** Sin eyebrow, sin párrafo de apoyo, sin repetir el
  título de la pantalla.

---

## 4 · Movimiento

- **Curva única para lo que entra**: `cubic-bezier(0.16, 1, 0.3, 1)`. Arranca
  rápido y frena largo.
- **Entradas escalonadas**: las secciones suben una detrás de otra con 70 ms
  entre ellas. La pantalla se arma sola.
- **Dos animaciones que tocan la misma propiedad no van en el mismo elemento.**
  Se separan en capas.
- **Nada salta.** Un contenedor mantiene su alto entre cargando y cargado; el
  elemento activo se eleva con sombra, no con desplazamiento.
- Duraciones: entrada 300-420 ms · despliegue de navegación 700 ms.

---

## 5 · Voz

Producto, no infraestructura. Lenguaje de taller, no de contador.

- Error: «No pudimos cargar las órdenes. Reintenta.» Nunca «500» ni «el servidor
  no responde».
- Vacío: qué falta y quién lo llena. «Todavía no hay repuestos en inventario.
  Registra una compra para empezar.»
- Botón: el verbo de lo que va a pasar — *Registrar venta*, *Cerrar orden* —,
  nunca *Aceptar*.
- Aviso: un solo botón, **Entendido**.
- El encabezado de una columna no se repite dentro de sus celdas.
- Poco texto. Si una línea se puede borrar sin perder información, se borra.
- Los términos contables se traducen donde el mecánico los ve: «Cobros y pagos»,
  no «Cartera». En los informes formales sí va el nombre contable, porque ahí el
  lector es el contador.

---

## 6 · Datos y gráficas

**La forma se decide antes que el color**, y la primera pregunta es si el dato
necesita una gráfica.

| El dato es… | Forma | No |
|---|---|---|
| Una cifra de hoy, con o sin tendencia | KPI con sparkline | una barra sola |
| Un puñado de cifras de cabecera | fila de KPI | barras agrupadas |
| Cómo cambió algo en el tiempo | línea (con área si es una serie) | barras por fecha |
| Comparar categorías | barras; horizontal si los nombres son largos | dona de 8 porciones |
| Parte-todo, hasta ~5 clases | barras apiladas o dona | pastel de 2 rebanadas |
| Más de ~7 clases con significado | tabla (o tabla + gráfica) | más colores |
| Distancia a una meta | barras divergentes o línea contra la base | dos ejes Y |

Reglas de lectura:

- **Ningún número puede exigir una interacción para leerse.** En la app no hay
  hover: lo que mostraría un tooltip va en un rótulo o en la tabla de al lado.
  No es una preferencia, es la única vía.
- **Si la historia es «esta subió», es énfasis, no categórico**: la serie del
  cuento va en color, el resto en gris.
- **El texto nunca se pinta del color de la serie.** La identidad la lleva el
  punto o la marca al lado; el texto va en gris.
- **Nunca dos ejes Y.** Ventas y margen son dos gráficas.
- Una sola serie va toda del mismo color: la longitud ya dice el valor.
- Leyenda obligatoria desde dos series; con una sola, el título ya la nombra.
- Rótulos directos **selectivos** (el extremo, el máximo), nunca uno por punto.
- Los datos de ejemplo (`backend/app/demo.py`) se rotulan como tales.

### Paleta de series

```
SERIES CLARO (orden fijo, nunca en ciclo)
  1 #B11212 rojo marca · 2 #2A78D6 azul · 3 #12996D verde azulado
  4 #A8730A ambar       · 5 #4A3AA7 violeta · 6 #CF5F88 magenta · 7 #0B7A3F verde
SERIES OSCURO (re-escalonado, no invertido)
  1 #E5484D · 2 #5598E7 · 3 #2CC08A · 4 #D19A27 · 5 #8C7BE0 · 6 #E88BB0 · 7 #3FA96B
CONTEXTO   claro #C9C7C1   oscuro #4A4A4E   (las series que no son el punto)
SECUENCIAL #FFE0E1 #FFC2C4 #FF9499 #FF5961 #EE2A30 #C81619 #B11212 #8E0E0E
DIVERGENTE negativo #8E0E0E #B11212 #FF5961 #FF9499 · neutro #EFEEEB
           positivo #9EC5F4 #5598E7 #2A78D6 #184F95
ESTADO     bien #34C759 · atencion #FF9500 · grave #EC835A · critico #FF3B30
TINTA      texto #0B0B0B / #52514E · ticks #898781 · rejilla #E5E4DF
```

- Los slots se asignan **en orden**, nunca en ciclo. Una 8.ª serie se agrupa en
  «Otros» o se parte en varias gráficas; jamás se inventa un color.
- El divergente es el natural del negocio: **rojo pierde, azul gana**. Sirve
  igual para margen, para saldo de cobros y para diferencia contra el mes
  pasado.
- Los colores de estado están **reservados**: nunca hacen de «serie 4», y
  siempre van con icono y rótulo, no solos.
- La paleta clara está validada contra blanco. La oscura es un re-escalonado a
  ojo sobre `#0D0D0F`: **está pendiente pasarla por un validador** de contraste
  y de protanopia/deuteranopia. Anotado, no disimulado.

---

## 7 · Estados semánticos

Cuatro papeles, no una lista de colores: **bien · atención · peligro ·
información**. Los valores concretos los trae la capa 2 (usa los del sistema
operativo, para que la app se sienta nativa). Lo que no cambia:

- El color **nunca va solo**: icono o rótulo lo acompañan.
- Un estado tiene dos presentaciones: **sólida** (fondo del color, texto encima)
  para lo que hay que ver de lejos, y **suave** (fondo lavado, texto del color)
  para lo que solo matiza.
- **El rojo de marca no es «peligro».** Son cosas distintas aunque se parezcan:
  el botón *Registrar venta* y el aviso *Saldo vencido* no pueden ser el mismo
  rojo. Peligro es `#FF3B30`; marca es `#B11212`.
- **El azul de marca no es «información».** Mismo problema, misma solución: info
  es `#007AFF`, acento de marca es `#2A78D6`.
