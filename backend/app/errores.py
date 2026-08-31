"""Errores de dominio.

`ReglaNegocio` representa una operacion invalida segun las reglas del taller
(stock insuficiente, asiento descuadrado, abono mayor al saldo...). El manejador
global de `main.py` la traduce a un HTTP 400 con un mensaje legible en espanol.
"""

from __future__ import annotations


class ReglaNegocio(Exception):
    """La operacion es imposible segun las reglas del negocio."""

    def __init__(self, mensaje: str) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje


class NoEncontrado(ReglaNegocio):
    """El recurso solicitado no existe."""
