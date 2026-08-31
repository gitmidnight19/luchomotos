"""Modelo de datos del taller (SQLAlchemy 2.0).

Los nombres de tablas y columnas se mantienen compatibles con la base de datos
del sistema original, de modo que un `taller.db` existente sigue funcionando.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Config(Base):
    __tablename__ = "config"
    clave: Mapped[str] = mapped_column(String, primary_key=True)
    valor: Mapped[str | None] = mapped_column(String)


class Cuenta(Base):
    __tablename__ = "cuentas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String, unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String)
    #: ACTIVO, PASIVO, PATRIMONIO, INGRESO, COSTO, GASTO
    tipo: Mapped[str] = mapped_column(String, index=True)
    #: D (deudora) o C (acreedora)
    naturaleza: Mapped[str] = mapped_column(String)
    movimiento: Mapped[int] = mapped_column(Integer, default=1)
    sistema: Mapped[int] = mapped_column(Integer, default=0)


class Asiento(Base):
    __tablename__ = "asientos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fecha: Mapped[date] = mapped_column(Date, index=True)
    doc_tipo: Mapped[str] = mapped_column(String, index=True)
    doc_id: Mapped[int | None] = mapped_column(Integer, index=True)
    descripcion: Mapped[str | None] = mapped_column(String)
    anulado: Mapped[int] = mapped_column(Integer, default=0)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    lineas: Mapped[list[AsientoLinea]] = relationship(
        back_populates="asiento", cascade="all, delete-orphan", lazy="selectin"
    )


class AsientoLinea(Base):
    __tablename__ = "asiento_lineas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asiento_id: Mapped[int] = mapped_column(
        ForeignKey("asientos.id", ondelete="CASCADE"), index=True
    )
    cuenta_id: Mapped[int] = mapped_column(ForeignKey("cuentas.id"), index=True)
    debe: Mapped[float] = mapped_column(Float, default=0)
    haber: Mapped[float] = mapped_column(Float, default=0)
    detalle: Mapped[str | None] = mapped_column(String)

    asiento: Mapped[Asiento] = relationship(back_populates="lineas")
    cuenta: Mapped[Cuenta] = relationship(lazy="joined")


class Tercero(Base):
    __tablename__ = "terceros"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    #: cliente, proveedor o ambos
    tipo: Mapped[str] = mapped_column(String, default="cliente")
    nombre: Mapped[str] = mapped_column(String, index=True)
    documento: Mapped[str | None] = mapped_column(String)
    telefono: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)
    direccion: Mapped[str | None] = mapped_column(String)
    notas: Mapped[str | None] = mapped_column(Text)
    activo: Mapped[int] = mapped_column(Integer, default=1)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class Moto(Base):
    __tablename__ = "motos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("terceros.id"), index=True)
    placa: Mapped[str | None] = mapped_column(String, index=True)
    marca: Mapped[str | None] = mapped_column(String)
    linea: Mapped[str | None] = mapped_column(String)
    modelo: Mapped[str | None] = mapped_column(String)
    cilindraje: Mapped[str | None] = mapped_column(String)
    color: Mapped[str | None] = mapped_column(String)
    notas: Mapped[str | None] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    cliente: Mapped[Tercero | None] = relationship(lazy="joined")


class Categoria(Base):
    __tablename__ = "categorias"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String, unique=True)


class Producto(Base):
    __tablename__ = "productos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sku: Mapped[str | None] = mapped_column(String, unique=True)
    nombre: Mapped[str] = mapped_column(String, index=True)
    categoria_id: Mapped[int | None] = mapped_column(ForeignKey("categorias.id"))
    unidad: Mapped[str | None] = mapped_column(String, default="UND")
    stock: Mapped[float] = mapped_column(Float, default=0)
    costo_promedio: Mapped[float] = mapped_column(Float, default=0)
    precio_venta: Mapped[float] = mapped_column(Float, default=0)
    stock_min: Mapped[float] = mapped_column(Float, default=0)
    ubicacion: Mapped[str | None] = mapped_column(String)
    iva_pct: Mapped[float | None] = mapped_column(Float)
    activo: Mapped[int] = mapped_column(Integer, default=1)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    categoria: Mapped[Categoria | None] = relationship(lazy="joined")


class Servicio(Base):
    __tablename__ = "servicios"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str | None] = mapped_column(String, unique=True)
    nombre: Mapped[str] = mapped_column(String)
    precio: Mapped[float] = mapped_column(Float, default=0)
    duracion_min: Mapped[int | None] = mapped_column(Integer, default=0)
    activo: Mapped[int] = mapped_column(Integer, default=1)


class Kardex(Base):
    __tablename__ = "kardex"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), index=True)
    fecha: Mapped[date] = mapped_column(Date)
    #: ENTRADA, SALIDA o AJUSTE
    tipo: Mapped[str] = mapped_column(String)
    doc_tipo: Mapped[str | None] = mapped_column(String)
    doc_id: Mapped[int | None] = mapped_column(Integer)
    cantidad: Mapped[float] = mapped_column(Float)
    costo_unit: Mapped[float] = mapped_column(Float, default=0)
    costo_total: Mapped[float] = mapped_column(Float, default=0)
    saldo_cant: Mapped[float] = mapped_column(Float, default=0)
    saldo_costo: Mapped[float] = mapped_column(Float, default=0)
    saldo_unit: Mapped[float] = mapped_column(Float, default=0)
    nota: Mapped[str | None] = mapped_column(String)


class Compra(Base):
    __tablename__ = "compras"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    numero: Mapped[str | None] = mapped_column(String)
    fecha: Mapped[date] = mapped_column(Date, index=True)
    proveedor_id: Mapped[int | None] = mapped_column(ForeignKey("terceros.id"), index=True)
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    iva: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    forma_pago: Mapped[str] = mapped_column(String, default="contado")
    metodo: Mapped[str | None] = mapped_column(String, default="efectivo")
    saldo: Mapped[float] = mapped_column(Float, default=0)
    estado: Mapped[str] = mapped_column(String, default="activa")
    nota: Mapped[str | None] = mapped_column(String)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    proveedor: Mapped[Tercero | None] = relationship(lazy="joined")
    lineas: Mapped[list[CompraLinea]] = relationship(
        back_populates="compra", cascade="all, delete-orphan", lazy="selectin"
    )


class CompraLinea(Base):
    __tablename__ = "compra_lineas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    compra_id: Mapped[int] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), index=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    cantidad: Mapped[float] = mapped_column(Float)
    costo_unit: Mapped[float] = mapped_column(Float)
    iva_pct: Mapped[float] = mapped_column(Float, default=0)
    subtotal: Mapped[float] = mapped_column(Float, default=0)

    compra: Mapped[Compra] = relationship(back_populates="lineas")
    producto: Mapped[Producto] = relationship(lazy="joined")


class Orden(Base):
    __tablename__ = "ordenes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    numero: Mapped[str | None] = mapped_column(String)
    fecha: Mapped[date] = mapped_column(Date, index=True)
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("terceros.id"))
    moto_id: Mapped[int | None] = mapped_column(ForeignKey("motos.id"))
    km: Mapped[int | None] = mapped_column(Integer)
    #: abierta, en_proceso, terminada, facturada, anulada
    estado: Mapped[str] = mapped_column(String, default="abierta", index=True)
    mecanico: Mapped[str | None] = mapped_column(String)
    diagnostico: Mapped[str | None] = mapped_column(Text)
    notas: Mapped[str | None] = mapped_column(Text)
    venta_id: Mapped[int | None] = mapped_column(Integer)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    cliente: Mapped[Tercero | None] = relationship(lazy="joined")
    moto: Mapped[Moto | None] = relationship(lazy="joined")
    items: Mapped[list[OrdenItem]] = relationship(
        back_populates="orden", cascade="all, delete-orphan", lazy="selectin"
    )


class OrdenItem(Base):
    __tablename__ = "orden_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    orden_id: Mapped[int] = mapped_column(ForeignKey("ordenes.id", ondelete="CASCADE"), index=True)
    #: producto o servicio
    tipo: Mapped[str] = mapped_column(String)
    producto_id: Mapped[int | None] = mapped_column(ForeignKey("productos.id"))
    servicio_id: Mapped[int | None] = mapped_column(ForeignKey("servicios.id"))
    descripcion: Mapped[str | None] = mapped_column(String)
    cantidad: Mapped[float] = mapped_column(Float, default=1)
    precio_unit: Mapped[float] = mapped_column(Float, default=0)
    iva_pct: Mapped[float] = mapped_column(Float, default=0)

    orden: Mapped[Orden] = relationship(back_populates="items")
    producto: Mapped[Producto | None] = relationship(lazy="joined")


class Venta(Base):
    __tablename__ = "ventas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    numero: Mapped[str | None] = mapped_column(String, index=True)
    fecha: Mapped[date] = mapped_column(Date, index=True)
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("terceros.id"), index=True)
    orden_id: Mapped[int | None] = mapped_column(ForeignKey("ordenes.id"))
    moto_id: Mapped[int | None] = mapped_column(ForeignKey("motos.id"))
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    descuento: Mapped[float] = mapped_column(Float, default=0)
    iva: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    costo_total: Mapped[float] = mapped_column(Float, default=0)
    forma_pago: Mapped[str] = mapped_column(String, default="contado")
    metodo: Mapped[str | None] = mapped_column(String, default="efectivo")
    saldo: Mapped[float] = mapped_column(Float, default=0)
    estado: Mapped[str] = mapped_column(String, default="activa", index=True)
    nota: Mapped[str | None] = mapped_column(String)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    cliente: Mapped[Tercero | None] = relationship(lazy="joined")
    moto: Mapped[Moto | None] = relationship(lazy="joined")
    lineas: Mapped[list[VentaLinea]] = relationship(
        back_populates="venta", cascade="all, delete-orphan", lazy="selectin"
    )


class VentaLinea(Base):
    __tablename__ = "venta_lineas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String)
    producto_id: Mapped[int | None] = mapped_column(ForeignKey("productos.id"))
    servicio_id: Mapped[int | None] = mapped_column(ForeignKey("servicios.id"))
    descripcion: Mapped[str | None] = mapped_column(String)
    cantidad: Mapped[float] = mapped_column(Float, default=1)
    precio_unit: Mapped[float] = mapped_column(Float, default=0)
    descuento: Mapped[float] = mapped_column(Float, default=0)
    iva_pct: Mapped[float] = mapped_column(Float, default=0)
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    costo_unit: Mapped[float] = mapped_column(Float, default=0)
    costo_total: Mapped[float] = mapped_column(Float, default=0)

    venta: Mapped[Venta] = relationship(back_populates="lineas")


class Gasto(Base):
    __tablename__ = "gastos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fecha: Mapped[date] = mapped_column(Date, index=True)
    cuenta_id: Mapped[int] = mapped_column(ForeignKey("cuentas.id"))
    descripcion: Mapped[str | None] = mapped_column(String)
    monto: Mapped[float] = mapped_column(Float)
    metodo: Mapped[str] = mapped_column(String, default="efectivo")
    proveedor_id: Mapped[int | None] = mapped_column(ForeignKey("terceros.id"))
    estado: Mapped[str] = mapped_column(String, default="activo")
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    cuenta: Mapped[Cuenta] = relationship(lazy="joined")
    proveedor: Mapped[Tercero | None] = relationship(lazy="joined")


class Pago(Base):
    __tablename__ = "pagos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fecha: Mapped[date] = mapped_column(Date, index=True)
    #: cobro (entra dinero) o pago (sale dinero)
    clase: Mapped[str] = mapped_column(String)
    tercero_id: Mapped[int | None] = mapped_column(ForeignKey("terceros.id"))
    doc_tipo: Mapped[str | None] = mapped_column(String)
    doc_id: Mapped[int | None] = mapped_column(Integer)
    monto: Mapped[float] = mapped_column(Float)
    metodo: Mapped[str] = mapped_column(String, default="efectivo")
    nota: Mapped[str | None] = mapped_column(String)
    estado: Mapped[str] = mapped_column(String, default="activo")
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    tercero: Mapped[Tercero | None] = relationship(lazy="joined")


__all__ = [
    "Asiento",
    "AsientoLinea",
    "Categoria",
    "Compra",
    "CompraLinea",
    "Config",
    "Cuenta",
    "Gasto",
    "Kardex",
    "Moto",
    "Orden",
    "OrdenItem",
    "Pago",
    "Producto",
    "Servicio",
    "Tercero",
    "Venta",
    "VentaLinea",
]
