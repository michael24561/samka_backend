import type { Request, Response } from "express";
import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import { resenaSchema } from "../lib/validators/resena.js";
import type { AuthedRequest } from "../middleware/auth.js";

export async function listResenas(req: Request, res: Response) {
  const { productoId } = req.params as { productoId: string };
  const { rows } = await query(
    `select r.id_resena, r.calificacion, r.comentario, r.fecha_creacion,
            u.nombre, u.imagen_perfil
     from public.resenas r
     join public.usuarios u on u.id_usuario = r.id_usuario
     where r.id_producto = $1
     order by r.fecha_creacion desc`,
    [productoId]
  );
  res.json({ resenas: rows });
}

export async function createResena(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const { productoId } = req.params as { productoId: string };
  const body = resenaSchema.parse(req.body);
  await query(
    `insert into public.resenas (id_usuario, id_producto, calificacion, comentario)
     values ($1, $2, $3, $4)
     on conflict (id_usuario, id_producto) do update
       set calificacion = excluded.calificacion, comentario = excluded.comentario, fecha_creacion = now()`,
    [userId, productoId, body.calificacion, body.comentario ?? null]
  );
  res.status(201).json({ ok: true });
}
