"""Clientes, proveedores, motos, repuestos y servicios."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..errores import NoEncontrado, ReglaNegocio
from ..models import Categoria, Moto, Orden, Producto, Servicio, Tercero, Venta
from ..schemas import (
    AjusteIn,
    CategoriaIn,
    CategoriaOut,
    KardexOut,
    MotoIn,
    MotoOut,
    Ok,
    ProductoIn,
    ProductoOut,
    ServicioIn,
    ServicioOut,
    TerceroIn,
    TerceroOut,
)
from ..services import informes, inventario

router = APIRouter()


# ------------------------------------------------------------------ terceros
@router.get("/terceros", response_model=list[TerceroOut], tags=["terceros"])
def listar_terceros(
    tipo: str | None = Query(None, description="cliente o proveedor"),
    solo_activos: bool = True,
    db: Session = Depends(get_db),
) -> list[TerceroOut]:
    consulta = informes.saldo_terceros(db)
    if tipo:
        consulta = consulta.where(or_(Tercero.tipo == tipo, Tercero.tipo == "ambos"))
    if solo_activos:
        consulta = consulta.where(Tercero.activo == 1)

    salida = []
    for tercero, deuda, pordar in db.execute(consulta.order_by(Tercero.nombre)).all():
        dto = TerceroOut.model_validate(tercero)
        dto.deuda = round(deuda or 0, 2)
        dto.pordar = round(pordar or 0, 2)
        salida.append(dto)
    return salida


@router.post("/terceros", response_model=TerceroOut, status_code=201, tags=["terceros"])
def crear_tercero(datos: TerceroIn, db: Session = Depends(get_db)) -> Tercero:
    tercero = Tercero(**datos.model_dump(exclude={"activo"}), activo=int(datos.activo))
    db.add(tercero)
    db.flush()
    return tercero


@router.put("/terceros/{tercero_id}", response_model=TerceroOut, tags=["terceros"])
def editar_tercero(tercero_id: int, datos: TerceroIn, db: Session = Depends(get_db)) -> Tercero:
    tercero = db.get(Tercero, tercero_id)
    if tercero is None:
        raise NoEncontrado("Tercero no encontrado")
    for campo, valor in datos.model_dump(exclude={"activo"}).items():
        setattr(tercero, campo, valor)
    tercero.activo = int(datos.activo)
    db.flush()
    return tercero


@router.delete("/terceros/{tercero_id}", response_model=Ok, tags=["terceros"])
def desactivar_tercero(tercero_id: int, db: Session = Depends(get_db)) -> Ok:
    tercero = db.get(Tercero, tercero_id)
    if tercero is None:
        raise NoEncontrado("Tercero no encontrado")
    tercero.activo = 0
    return Ok()


# --------------------------------------------------------------------- motos
def _moto_out(moto: Moto) -> MotoOut:
    dto = MotoOut.model_validate(moto)
    dto.cliente_nombre = moto.cliente.nombre if moto.cliente else None
    return dto


@router.get("/motos", response_model=list[MotoOut], tags=["motos"])
def listar_motos(cliente_id: int | None = None, db: Session = Depends(get_db)) -> list[MotoOut]:
    consulta = select(Moto).order_by(Moto.placa)
    if cliente_id:
        consulta = consulta.where(Moto.cliente_id == cliente_id)
    return [_moto_out(m) for m in db.scalars(consulta).all()]


@router.post("/motos", response_model=MotoOut, status_code=201, tags=["motos"])
def crear_moto(datos: MotoIn, db: Session = Depends(get_db)) -> MotoOut:
    moto = Moto(**{**datos.model_dump(), "placa": (datos.placa or "").upper() or None})
    db.add(moto)
    db.flush()
    return _moto_out(moto)


@router.put("/motos/{moto_id}", response_model=MotoOut, tags=["motos"])
def editar_moto(moto_id: int, datos: MotoIn, db: Session = Depends(get_db)) -> MotoOut:
    moto = db.get(Moto, moto_id)
    if moto is None:
        raise NoEncontrado("Moto no encontrada")
    for campo, valor in datos.model_dump().items():
        setattr(moto, campo, valor)
    moto.placa = (datos.placa or "").upper() or None
    db.flush()
    # Tras cambiar cliente_id la relacion cargada queda obsoleta.
    db.refresh(moto)
    return _moto_out(moto)


@router.delete("/motos/{moto_id}", response_model=Ok, tags=["motos"])
def borrar_moto(moto_id: int, db: Session = Depends(get_db)) -> Ok:
    moto = db.get(Moto, moto_id)
    if moto is None:
        raise NoEncontrado("Moto no encontrada")
    db.delete(moto)
    return Ok()


@router.get("/motos/{moto_id}/historial", tags=["motos"])
def historial_moto(moto_id: int, db: Session = Depends(get_db)) -> dict:
    ordenes = db.scalars(
        select(Orden).where(Orden.moto_id == moto_id).order_by(Orden.fecha.desc())
    ).all()
    ventas = db.scalars(
        select(Venta)
        .where(Venta.moto_id == moto_id, Venta.estado == "activa")
        .order_by(Venta.fecha.desc())
    ).all()
    return {
        "ordenes": [
            {
                "id": o.id,
                "numero": o.numero,
                "fecha": o.fecha,
                "km": o.km,
                "estado": o.estado,
                "diagnostico": o.diagnostico,
            }
            for o in ordenes
        ],
        "ventas": [
            {"id": v.id, "numero": v.numero, "fecha": v.fecha, "total": v.total} for v in ventas
        ],
    }


# ---------------------------------------------------------------- inventario
@router.get("/categorias", response_model=list[CategoriaOut], tags=["inventario"])
def listar_categorias(db: Session = Depends(get_db)) -> list[Categoria]:
    return list(db.scalars(select(Categoria).order_by(Categoria.nombre)).all())


@router.post("/categorias", response_model=CategoriaOut, status_code=201, tags=["inventario"])
def crear_categoria(datos: CategoriaIn, db: Session = Depends(get_db)) -> Categoria:
    existente = db.scalar(select(Categoria).where(Categoria.nombre == datos.nombre))
    if existente:
        return existente
    categoria = Categoria(nombre=datos.nombre)
    db.add(categoria)
    db.flush()
    return categoria


def _producto_out(producto: Producto) -> ProductoOut:
    dto = ProductoOut.model_validate(producto)
    dto.categoria_nombre = producto.categoria.nombre if producto.categoria else None
    return dto


@router.get("/productos", response_model=list[ProductoOut], tags=["inventario"])
def listar_productos(
    q: str | None = Query(None, description="Filtra por nombre o SKU"),
    bajo_minimo: bool = False,
    solo_activos: bool = True,
    db: Session = Depends(get_db),
) -> list[ProductoOut]:
    consulta = select(Producto).order_by(Producto.nombre)
    if solo_activos:
        consulta = consulta.where(Producto.activo == 1)
    if q:
        patron = f"%{q}%"
        consulta = consulta.where(or_(Producto.nombre.ilike(patron), Producto.sku.ilike(patron)))
    if bajo_minimo:
        consulta = consulta.where(Producto.stock <= Producto.stock_min)
    return [_producto_out(p) for p in db.scalars(consulta).all()]


@router.post("/productos", response_model=ProductoOut, status_code=201, tags=["inventario"])
def crear_producto(datos: ProductoIn, db: Session = Depends(get_db)) -> ProductoOut:
    if datos.sku and db.scalar(select(Producto).where(Producto.sku == datos.sku)):
        raise ReglaNegocio(f"Ya existe un repuesto con el codigo {datos.sku}")
    producto = Producto(
        **datos.model_dump(exclude={"stock_inicial", "costo_inicial", "fecha", "activo"}),
        activo=int(datos.activo),
    )
    db.add(producto)
    db.flush()
    if datos.stock_inicial > 0:
        inventario.saldo_inicial(
            db, producto.id, datos.stock_inicial, datos.costo_inicial, datos.fecha
        )
    return _producto_out(producto)


@router.put("/productos/{producto_id}", response_model=ProductoOut, tags=["inventario"])
def editar_producto(
    producto_id: int, datos: ProductoIn, db: Session = Depends(get_db)
) -> ProductoOut:
    producto = inventario.obtener_producto(db, producto_id)
    for campo, valor in datos.model_dump(
        exclude={"stock_inicial", "costo_inicial", "fecha", "activo"}
    ).items():
        setattr(producto, campo, valor)
    producto.activo = int(datos.activo)
    db.flush()
    # Tras cambiar categoria_id la relacion cargada queda obsoleta.
    db.refresh(producto)
    return _producto_out(producto)


@router.delete("/productos/{producto_id}", response_model=Ok, tags=["inventario"])
def desactivar_producto(producto_id: int, db: Session = Depends(get_db)) -> Ok:
    producto = inventario.obtener_producto(db, producto_id)
    producto.activo = 0
    return Ok()


@router.post("/inventario/ajuste", tags=["inventario"], summary="Ajustar existencias")
def ajustar_inventario(datos: AjusteIn, db: Session = Depends(get_db)) -> dict:
    delta = inventario.ajustar(
        db,
        producto_id=datos.producto_id,
        cantidad=datos.cantidad,
        modo=datos.modo,
        fecha=datos.fecha,
        costo_unit=datos.costo_unit,
        nota=datos.nota,
    )
    return {"ok": True, "delta": delta}


@router.get("/inventario/kardex/{producto_id}", response_model=list[KardexOut], tags=["inventario"])
def kardex(
    producto_id: int,
    desde: date | None = None,
    hasta: date | None = None,
    db: Session = Depends(get_db),
):
    return inventario.kardex(db, producto_id, desde, hasta)


# ----------------------------------------------------------------- servicios
@router.get("/servicios", response_model=list[ServicioOut], tags=["servicios"])
def listar_servicios(solo_activos: bool = True, db: Session = Depends(get_db)) -> list[Servicio]:
    consulta = select(Servicio).order_by(Servicio.nombre)
    if solo_activos:
        consulta = consulta.where(Servicio.activo == 1)
    return list(db.scalars(consulta).all())


@router.post("/servicios", response_model=ServicioOut, status_code=201, tags=["servicios"])
def crear_servicio(datos: ServicioIn, db: Session = Depends(get_db)) -> Servicio:
    servicio = Servicio(**datos.model_dump(exclude={"activo"}), activo=int(datos.activo))
    db.add(servicio)
    db.flush()
    return servicio


@router.put("/servicios/{servicio_id}", response_model=ServicioOut, tags=["servicios"])
def editar_servicio(servicio_id: int, datos: ServicioIn, db: Session = Depends(get_db)) -> Servicio:
    servicio = db.get(Servicio, servicio_id)
    if servicio is None:
        raise NoEncontrado("Servicio no encontrado")
    for campo, valor in datos.model_dump(exclude={"activo"}).items():
        setattr(servicio, campo, valor)
    servicio.activo = int(datos.activo)
    db.flush()
    return servicio


@router.delete("/servicios/{servicio_id}", response_model=Ok, tags=["servicios"])
def desactivar_servicio(servicio_id: int, db: Session = Depends(get_db)) -> Ok:
    servicio = db.get(Servicio, servicio_id)
    if servicio is None:
        raise NoEncontrado("Servicio no encontrado")
    servicio.activo = 0
    return Ok()


# -------------------------------------------------------------------- buscar
@router.get("/buscar", tags=["busqueda"], summary="Busqueda rapida para el mostrador")
def buscar(q: str, db: Session = Depends(get_db)) -> dict:
    datos = informes.buscar(db, q)
    return {
        "productos": [_producto_out(p) for p in datos["productos"]],
        "clientes": [TerceroOut.model_validate(c) for c in datos["clientes"]],
    }
