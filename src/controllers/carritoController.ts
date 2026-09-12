import type { Request, Response } from "express";
import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import type { AuthedRequest } from "../middleware/auth.js";

async function getOrCreateCart(userId: string) {
  const { rows } = await query<{ id_carrito: string }>(
    `insert into public.carritos (id_usuario) values ($1)
     on conflict (id_usuario) do update set fecha_actualizacion = now()
     returning id_carrito`,
    [userId]
  );
  return rows[0].id_carrito;
}

export async function getCart(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const cartId = await getOrCreateCart(userId);
  const { rows } = await query(
    `select dc.id_detalle_carrito, dc.id_producto, dc.cantidad,
            p.nombre, p.precio, coalesce(p.imagen_principal,
              (select ip.imagen_url from public.imagenes_producto ip
               where ip.id_producto = p.id_producto order by ip.principal desc limit 1)) as imagen
     from public.detalle_carrito dc
     join public.productos p on p.id_producto = dc.id_producto
     where dc.id_carrito = $1`,
    [cartId]
  );
  res.json({ carrito: rows });
}

export async function addToCart(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const cartId = await getOrCreateCart(userId);
  const { producto_id, cantidad } = req.body as { producto_id: string; cantidad?: number };
  if (!producto_id) throw new ApiError(400, "producto_id requerido");
  const qty = Math.max(1, Number(cantidad) || 1);

  await query(
    `insert into public.detalle_carrito (id_carrito, id_producto, cantidad)
     values ($1, $2, $3)
     on conflict (id_carrito, id_producto) do update set cantidad = detalle_carrito.cantidad + excluded.cantidad`,
    [cartId, producto_id, qty]
  );
  await query("update public.carritos set fecha_actualizacion = now() where id_carrito = $1", [cartId]);
  res.status(201).json({ ok: true });
}

export async function updateCartItem(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const cartId = await getOrCreateCart(userId);
  const { id } = req.params as { id: string };
  const { cantidad } = req.body as { cantidad?: number };
  const qty = Math.max(1, Number(cantidad) || 1);
  const { rowCount } = await query(
    `update public.detalle_carrito set cantidad = $3
     where id_detalle_carrito = $1 and id_carrito = $2`,
    [id, cartId, qty]
  );
  if (!rowCount) throw new ApiError(404, "Ítem del carrito no encontrado");
  res.json({ ok: true });
}

export async function removeFromCart(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const cartId = await getOrCreateCart(userId);
  const { id } = req.params as { id: string };
  const { rowCount } = await query(
    "delete from public.detalle_carrito where id_detalle_carrito = $1 and id_carrito = $2",
    [id, cartId]
  );
  if (!rowCount) throw new ApiError(404, "Ítem del carrito no encontrado");
  res.json({ ok: true });
}

export async function clearCart(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const cartId = await getOrCreateCart(userId);
  await query("delete from public.detalle_carrito where id_carrito = $1", [cartId]);
  res.json({ ok: true });
}
