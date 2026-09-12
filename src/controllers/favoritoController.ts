import type { Request, Response } from "express";
import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import type { AuthedRequest } from "../middleware/auth.js";

export async function listFavoritos(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const { rows } = await query(
    `select f.id_favorito, f.fecha_creacion, p.id_producto, p.nombre, p.slug, p.precio,
            coalesce(p.imagen_principal,
              (select ip.imagen_url from public.imagenes_producto ip
               where ip.id_producto = p.id_producto order by ip.principal desc limit 1)) as imagen
     from public.favoritos f
     join public.productos p on p.id_producto = f.id_producto
     where f.id_usuario = $1
     order by f.fecha_creacion desc`,
    [userId]
  );
  res.json({ favoritos: rows });
}

export async function addFavorito(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const { producto_id } = req.body as { producto_id?: string };
  if (!producto_id) throw new ApiError(400, "producto_id requerido");
  await query(
    `insert into public.favoritos (id_usuario, id_producto) values ($1, $2)
     on conflict (id_usuario, id_producto) do nothing`,
    [userId, producto_id]
  );
  res.status(201).json({ ok: true });
}

export async function removeFavorito(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const { producto_id } = req.params as { producto_id: string };
  await query(
    "delete from public.favoritos where id_usuario = $1 and id_producto = $2",
    [userId, producto_id]
  );
  res.json({ ok: true });
}
