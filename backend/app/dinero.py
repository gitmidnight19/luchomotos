"""El dinero se representa en centavos enteros. Nunca en `float`.

Un importe en coma flotante no puede sumarse sin error: `68541.0 + 13022.79`
da `81563.79000000001`, y eso hizo que asientos reales no cuadraran y que la
cuenta de control del inventario se desviara del auxiliar. Con enteros la
igualdad es exacta y el invariante contable se puede comprobar con `==`.

Las **cantidades** siguen siendo `float`: medio litro de aceite es legitimo.
Lo que nunca puede ser `float` es el dinero.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

#: Importe monetario en centavos. Positivo o negativo, siempre entero.
Centavos = int


def a_centavos(valor: str | int | float | Decimal) -> Centavos:
    """Convierte un importe de la frontera exterior a centavos.

    Se pasa por `Decimal` para que `19.99` se lea como 1999 y no como 1998,
    que es lo que daria `int(19.99 * 100)`.
    """
    return int((Decimal(str(valor)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def a_pesos(centavos: Centavos) -> Decimal:
    """Solo para presentacion o exportacion. Nunca para calcular."""
    return (Decimal(centavos) / 100).quantize(Decimal("0.01"))


def porcentaje(base: Centavos, tasa: float) -> Centavos:
    """Aplica una tasa (por ejemplo el IVA) redondeando al centavo."""
    return int(
        (Decimal(base) * Decimal(str(tasa)) / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


def multiplicar(precio: Centavos, cantidad: float) -> Centavos:
    """Precio unitario por cantidad, redondeado al centavo."""
    return int(
        (Decimal(precio) * Decimal(str(cantidad))).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


def repartir(total: Centavos, pesos: list[float]) -> list[Centavos]:
    """Reparte `total` en partes proporcionales a `pesos`, sin perder centavos.

    Metodo del resto mayor: se asigna la parte entera a cada uno y los centavos
    sobrantes van a quienes tengan mayor residuo. La suma del resultado es
    exactamente `total`, propiedad que el redondeo independiente no garantiza.

    >>> repartir(100, [1, 1, 1])
    [34, 33, 33]
    >>> sum(repartir(1000, [3, 5, 2]))
    1000
    """
    if not pesos:
        return []
    suma = sum(pesos)
    if suma <= 0:
        # Sin base para prorratear: todo al primero, para no perder el importe.
        return [total] + [0] * (len(pesos) - 1)

    exactos = [total * peso / suma for peso in pesos]
    partes = [int(x) for x in exactos]
    faltan = total - sum(partes)

    # Reparte el sobrante entre los mayores residuos, de mayor a menor.
    orden = sorted(range(len(pesos)), key=lambda i: exactos[i] - partes[i], reverse=True)
    for i in range(abs(faltan)):
        partes[orden[i % len(orden)]] += 1 if faltan > 0 else -1
    return partes
