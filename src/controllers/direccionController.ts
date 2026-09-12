import type { Request, Response } from "express";
import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import { direccionSchema } from "../lib/validators/direccion.js";
import type { AuthedRequest } from "../middleware/auth.js";

export async function listDirecciones(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const { rows } = await query(
    `select * from public.direcciones where id_usuario = $1
     order by predeterminada desc, id_direccion`,
    [userId]
  );
  res.json({ direcciones: rows });
}

export async function createDireccion(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const body = direccionSchema.parse(req.body);

  if (body.predeterminada) {
    await query("update public.direcciones set predeterminada = false where id_usuario = $1", [
      userId,
    ]);
  }

  const { rows } = await query(
    `insert into public.direcciones
       (id_usuario, nombre_destinatario, telefono, direccion, distrito, provincia,
        departamento, codigo_postal, referencia, predeterminada, lat, lng)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning *`,
    [
      userId,
      body.nombre_destinatario,
      body.telefono ?? null,
      body.direccion,
      body.distrito,
      body.provincia,
      body.departamento,
      body.codigo_postal ?? null,
      body.referencia ?? null,
      body.predeterminada ?? false,
      body.lat ?? null,
      body.lng ?? null,
    ]
  );
  res.status(201).json({ direccion: rows[0] });
}

export async function updateDireccion(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const { id } = req.params as { id: string };
  const body = direccionSchema.partial().parse(req.body);

  if (body.predeterminada) {
    await query("update public.direcciones set predeterminada = false where id_usuario = $1", [
      userId,
    ]);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  const cols = [
    "nombre_destinatario",
    "telefono",
    "direccion",
    "distrito",
    "provincia",
    "departamento",
    "codigo_postal",
    "referencia",
    "predeterminada",
    "lat",
    "lng",
  ] as const;
  for (const col of cols) {
    if (body[col as keyof typeof body] !== undefined) {
      values.push(body[col as keyof typeof body] ?? null);
      fields.push(`${col} = $${values.length}`);
    }
  }
  if (!fields.length) throw new ApiError(400, "Sin campos para actualizar");
  values.push(id, userId);
  const { rowCount } = await query(
    `update public.direcciones set ${fields.join(", ")} where id_direccion = $${values.length - 1} and id_usuario = $${values.length}`,
    values
  );
  if (!rowCount) throw new ApiError(404, "Dirección no encontrada");
  res.json({ ok: true });
}

export async function deleteDireccion(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user!.userId;
  const { id } = req.params as { id: string };
  const { rowCount } = await query(
    "delete from public.direcciones where id_direccion = $1 and id_usuario = $2",
    [id, userId]
  );
  if (!rowCount) throw new ApiError(404, "Dirección no encontrada");
  res.json({ ok: true });
}
