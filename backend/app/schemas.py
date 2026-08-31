"""Esquemas Pydantic: contrato de la API que consume la app movil."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FormaPago = Literal["contado", "credito"]
MetodoPago = Literal["efectivo", "banco"]
MetodoGasto = Literal["efectivo", "banco", "credito"]
TipoTercero = Literal["cliente", "proveedor", "ambos"]
EstadoOrden = Literal["abierta", "en_proceso", "terminada", "facturada", "anulada"]
EstadoDocumento = Literal["activa", "anulada"]
EstadoRegistro = Literal["activo", "anulado"]
TipoLinea = Literal["producto", "servicio"]
ClasePago = Literal["cobro", "pago"]
TipoKardex = Literal["ENTRADA", "SALIDA", "AJUSTE"]
TipoCuenta = Literal["ACTIVO", "PASIVO", "PATRIMONIO", "INGRESO", "COSTO", "GASTO"]
Naturaleza = Literal["D", "C"]


class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------ catalogos
class CuentaOut(Base):
    id: int
    codigo: str
    nombre: str
    tipo: TipoCuenta
    naturaleza: Naturaleza


class CuentaIn(BaseModel):
    codigo: str
    nombre: str
    tipo: TipoCuenta
    naturaleza: Naturaleza


class TerceroIn(BaseModel):
    nombre: str = Field(min_length=1)
    tipo: TipoTercero = "cliente"
    documento: str | None = None
    telefono: str | None = None
    email: str | None = None
    direccion: str | None = None
    notas: str | None = None
    activo: bool = True


class TerceroOut(Base):
    id: int
    tipo: TipoTercero
    nombre: str
    documento: str | None
    telefono: str | None
    email: str | None
    direccion: str | None
    notas: str | None
    activo: int
    deuda: float = 0
    pordar: float = 0


class MotoIn(BaseModel):
    placa: str | None = None
    cliente_id: int | None = None
    marca: str | None = None
    linea: str | None = None
    modelo: str | None = None
    cilindraje: str | None = None
    color: str | None = None
    notas: str | None = None


class MotoOut(Base):
    id: int
    cliente_id: int | None
    placa: str | None
    marca: str | None
    linea: str | None
    modelo: str | None
    cilindraje: str | None
    color: str | None
    notas: str | None
    cliente_nombre: str | None = None


class CategoriaOut(Base):
    id: int
    nombre: str


class CategoriaIn(BaseModel):
    nombre: str


class ProductoIn(BaseModel):
    nombre: str = Field(min_length=1)
    sku: str | None = None
    categoria_id: int | None = None
    unidad: str = "UND"
    precio_venta: float = 0
    stock_min: float = 0
    ubicacion: str | None = None
    iva_pct: float | None = None
    activo: bool = True
    #: Solo al crear: carga inicial de existencias contra capital.
    stock_inicial: float = 0
    costo_inicial: float = 0
    fecha: date | None = None


class ProductoOut(Base):
    id: int
    sku: str | None
    nombre: str
    categoria_id: int | None
    categoria_nombre: str | None = None
    unidad: str | None
    stock: float
    costo_promedio: float
    precio_venta: float
    stock_min: float
    ubicacion: str | None
    iva_pct: float | None
    activo: int


class ServicioIn(BaseModel):
    nombre: str = Field(min_length=1)
    codigo: str | None = None
    precio: float = 0
    duracion_min: int = 0
    activo: bool = True


class ServicioOut(Base):
    id: int
    codigo: str | None
    nombre: str
    precio: float
    duracion_min: int | None
    activo: int


class KardexOut(Base):
    id: int
    fecha: date
    tipo: TipoKardex
    doc_tipo: str | None
    doc_id: int | None
    cantidad: float
    costo_unit: float
    costo_total: float
    saldo_cant: float
    saldo_costo: float
    saldo_unit: float
    nota: str | None


class AjusteIn(BaseModel):
    producto_id: int
    cantidad: float
    modo: Literal["conteo", "delta"] = "conteo"
    costo_unit: float | None = None
    fecha: date | None = None
    nota: str | None = None


# --------------------------------------------------------------------- ventas
class VentaLineaIn(BaseModel):
    tipo: Literal["producto", "servicio"] = "producto"
    producto_id: int | None = None
    servicio_id: int | None = None
    descripcion: str | None = None
    cantidad: float = Field(default=1, gt=0)
    precio_unit: float = Field(default=0, ge=0)
    descuento: float = Field(default=0, ge=0)
    iva_pct: float | None = None


class VentaIn(BaseModel):
    fecha: date | None = None
    cliente_id: int | None = None
    moto_id: int | None = None
    orden_id: int | None = None
    forma_pago: FormaPago = "contado"
    metodo: MetodoPago = "efectivo"
    nota: str | None = None
    lineas: list[VentaLineaIn] = Field(min_length=1)


class VentaLineaOut(Base):
    id: int
    tipo: TipoLinea
    producto_id: int | None
    servicio_id: int | None
    descripcion: str | None
    cantidad: float
    precio_unit: float
    descuento: float
    iva_pct: float
    subtotal: float
    costo_total: float


class VentaOut(Base):
    id: int
    numero: str | None
    fecha: date
    cliente_id: int | None
    cliente_nombre: str | None = None
    moto_id: int | None
    subtotal: float
    descuento: float
    iva: float
    total: float
    costo_total: float
    forma_pago: FormaPago
    metodo: MetodoPago | None
    saldo: float
    estado: EstadoDocumento
    nota: str | None


class PagoOut(Base):
    id: int
    fecha: date
    clase: ClasePago
    tercero_id: int | None
    tercero_nombre: str | None = None
    doc_tipo: str | None
    doc_id: int | None
    monto: float
    metodo: MetodoPago
    nota: str | None


class VentaDetalle(VentaOut):
    documento: str | None = None
    telefono: str | None = None
    direccion: str | None = None
    placa: str | None = None
    marca: str | None = None
    linea_moto: str | None = None
    lineas: list[VentaLineaOut] = []
    pagos: list[PagoOut] = []


# -------------------------------------------------------------------- compras
class CompraLineaIn(BaseModel):
    producto_id: int
    cantidad: float = Field(gt=0)
    costo_unit: float = Field(ge=0)
    iva_pct: float | None = None
    #: Si viene, actualiza el precio de venta del repuesto.
    precio_venta: float | None = None


class CompraIn(BaseModel):
    fecha: date | None = None
    proveedor_id: int | None = None
    numero: str | None = None
    forma_pago: FormaPago = "contado"
    metodo: MetodoPago = "efectivo"
    nota: str | None = None
    lineas: list[CompraLineaIn] = Field(min_length=1)


class CompraLineaOut(Base):
    id: int
    producto_id: int
    producto_nombre: str | None = None
    sku: str | None = None
    cantidad: float
    costo_unit: float
    iva_pct: float
    subtotal: float


class CompraOut(Base):
    id: int
    numero: str | None
    fecha: date
    proveedor_id: int | None
    proveedor_nombre: str | None = None
    subtotal: float
    iva: float
    total: float
    forma_pago: FormaPago
    metodo: MetodoPago | None
    saldo: float
    estado: EstadoDocumento
    nota: str | None


class CompraDetalle(CompraOut):
    lineas: list[CompraLineaOut] = []


# --------------------------------------------------------- gastos y tesoreria
class GastoIn(BaseModel):
    cuenta_id: int
    monto: float = Field(gt=0)
    fecha: date | None = None
    descripcion: str | None = None
    metodo: MetodoGasto = "efectivo"
    proveedor_id: int | None = None


class GastoOut(Base):
    id: int
    fecha: date
    cuenta_id: int
    cuenta_codigo: str | None = None
    cuenta_nombre: str | None = None
    descripcion: str | None
    monto: float
    metodo: MetodoGasto
    proveedor_id: int | None
    proveedor_nombre: str | None = None
    estado: EstadoRegistro


class PagoIn(BaseModel):
    clase: Literal["cobro", "pago"]
    monto: float = Field(gt=0)
    fecha: date | None = None
    doc_id: int | None = None
    tercero_id: int | None = None
    metodo: MetodoPago = "efectivo"
    nota: str | None = None


class TrasladoIn(BaseModel):
    monto: float = Field(gt=0)
    origen: MetodoPago = "efectivo"
    destino: MetodoPago = "banco"
    fecha: date | None = None
    nota: str | None = None


class AsientoLineaIn(BaseModel):
    cuenta_id: int
    debe: float = 0
    haber: float = 0
    detalle: str | None = None


class AsientoManualIn(BaseModel):
    fecha: date | None = None
    descripcion: str | None = None
    lineas: list[AsientoLineaIn] = Field(min_length=2)


# --------------------------------------------------------- ordenes de trabajo
class OrdenItemIn(BaseModel):
    tipo: Literal["producto", "servicio"] = "servicio"
    producto_id: int | None = None
    servicio_id: int | None = None
    descripcion: str | None = None
    cantidad: float = Field(default=1, gt=0)
    precio_unit: float = Field(default=0, ge=0)
    iva_pct: float | None = None


class OrdenIn(BaseModel):
    fecha: date | None = None
    cliente_id: int | None = None
    moto_id: int | None = None
    km: int | None = None
    estado: EstadoOrden = "abierta"
    mecanico: str | None = None
    diagnostico: str | None = None
    notas: str | None = None
    items: list[OrdenItemIn] = []


class OrdenItemOut(Base):
    id: int
    tipo: TipoLinea
    producto_id: int | None
    servicio_id: int | None
    descripcion: str | None
    cantidad: float
    precio_unit: float
    iva_pct: float
    stock: float | None = None


class OrdenOut(Base):
    id: int
    numero: str | None
    fecha: date
    cliente_id: int | None
    cliente_nombre: str | None = None
    moto_id: int | None
    placa: str | None = None
    marca: str | None = None
    linea_moto: str | None = None
    km: int | None
    estado: EstadoOrden
    mecanico: str | None
    diagnostico: str | None
    notas: str | None
    venta_id: int | None
    total: float = 0


class OrdenDetalle(OrdenOut):
    telefono: str | None = None
    modelo: str | None = None
    items: list[OrdenItemOut] = []


class FacturarOrdenIn(BaseModel):
    forma_pago: FormaPago = "contado"
    metodo: MetodoPago = "efectivo"
    fecha: date | None = None


# -------------------------------------------------------------------- informes
class SaldoCuenta(BaseModel):
    id: int
    codigo: str
    nombre: str
    tipo: TipoCuenta
    naturaleza: Naturaleza
    debe: float
    haber: float
    saldo: float


class EstadoResultados(BaseModel):
    desde: date
    hasta: date
    ingresos: list[SaldoCuenta]
    costos: list[SaldoCuenta]
    gastos: list[SaldoCuenta]
    total_ingresos: float
    total_costos: float
    total_gastos: float
    utilidad_bruta: float
    utilidad_neta: float
    margen_bruto: float
    margen_neto: float


class BalanceGeneral(BaseModel):
    hasta: date
    activos: list[SaldoCuenta]
    pasivos: list[SaldoCuenta]
    patrimonio: list[SaldoCuenta]
    utilidad_ejercicio: float
    total_activos: float
    total_pasivos: float
    total_patrimonio: float
    diferencia: float


class PuntoSerie(BaseModel):
    fecha: date
    ventas: float
    costo: float
    margen: float


class ItemTop(BaseModel):
    nombre: str | None
    cant: float
    monto: float


class ProductoBajo(BaseModel):
    id: int
    sku: str | None
    nombre: str
    stock: float
    stock_min: float
    precio_venta: float


class Dashboard(BaseModel):
    fecha: date
    ventas_hoy: float
    ventas_mes: float
    num_ventas_mes: int
    ticket_promedio: float
    costo_mes: float
    utilidad_bruta_mes: float
    utilidad_neta_mes: float
    gastos_mes: float
    margen_mes: float
    utilidad_anio: float
    ingresos_anio: float
    caja: float
    banco: float
    efectivo_total: float
    cxc: float
    cxp: float
    inventario_valor: float
    inventario_venta: float
    num_bajo_stock: int
    ordenes_abiertas: int
    bajo_stock: list[ProductoBajo]
    serie: list[PuntoSerie]
    top_productos: list[ItemTop]
    top_servicios: list[ItemTop]


class FilaCartera(BaseModel):
    id: int
    numero: str | None
    fecha: date
    tercero: str | None
    telefono: str | None
    dias: int
    total: float
    saldo: float


class Cartera(BaseModel):
    por_cobrar: list[FilaCartera]
    por_pagar: list[FilaCartera]
    total_cobrar: float
    total_pagar: float


class InventarioItem(ProductoOut):
    valor_costo: float
    valor_venta: float
    utilidad_pot: float
    margen: float


class InventarioValorizado(BaseModel):
    items: list[InventarioItem]
    total_costo: float
    total_venta: float
    unidades: float


class VentaPeriodo(BaseModel):
    periodo: str
    num: int
    subtotal: float
    iva: float
    total: float
    costo: float
    utilidad: float
    margen: float


class MovimientoCaja(BaseModel):
    fecha: date
    doc_tipo: str
    descripcion: str | None
    entra: float
    sale: float
    saldo: float


class FlujoCaja(BaseModel):
    saldo_inicial: float
    saldo_final: float
    total_entradas: float
    total_salidas: float
    movimientos: list[MovimientoCaja]


class LineaAsientoOut(BaseModel):
    codigo: str
    nombre: str
    debe: float
    haber: float
    detalle: str | None


class AsientoOut(BaseModel):
    id: int
    fecha: date
    doc_tipo: str
    doc_id: int | None
    descripcion: str | None
    anulado: int
    total: float
    lineas: list[LineaAsientoOut]


class MovimientoMayor(BaseModel):
    fecha: date
    doc_tipo: str
    doc_id: int | None
    descripcion: str | None
    detalle: str | None
    debe: float
    haber: float
    saldo: float


class LibroMayor(BaseModel):
    cuenta: CuentaOut
    saldo_inicial: float
    saldo_final: float
    movimientos: list[MovimientoMayor]


class BalancePrueba(BaseModel):
    filas: list[SaldoCuenta]
    total_debe: float
    total_haber: float


class Impuestos(BaseModel):
    desde: date
    hasta: date
    iva_generado: float
    iva_descontable: float
    saldo_a_pagar: float


class EstadoSistema(BaseModel):
    ventas: int
    productos: int
    cuadre: float
    version: str
    empresa: str
    servidor: str


class Ok(BaseModel):
    ok: bool = True


class CreadoOut(BaseModel):
    id: int
    numero: str | None = None
