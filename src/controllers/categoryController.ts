import type { Request, Response } from "express";
import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import { categorySchema } from "../lib/validators/category.js";

export async function listCategories(_req: Request, res: Response) {
  const { rows } = await query(
    `select c.*,
            (select count(*)::int from public.productos p where p.id_categoria = c.id_categoria) as cantidad_productos
     from public.categorias c
     order by c.orden_visual, c.nombre`
  );
  res.json({ categorias: rows });
}

export async function getCategory(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { rows } = await query(
    `select c.*,
            (select count(*)::int from public.productos p where p.id_categoria = c.id_categoria) as cantidad_productos
     from public.categorias c where c.id_categoria = $1`,
    [id]
  );
  const category = rows[0];
  if (!category) throw new ApiError(404, "Categoría no encontrada");
  res.json({ categoria: category });
}

export async function createCategory(req: Request, res: Response) {
  const body = categorySchema.parse(req.body);
  const { rows } = await query<{ id_categoria: string }>(
    `insert into public.categorias (nombre, slug, descripcion, imagen_url, orden_visual, estado)
     values ($1,$2,$3,$4,$5,$6) returning id_categoria`,
    [body.nombre, body.slug, body.descripcion, body.imagen_url, body.orden_visual, body.estado]
  );
  res.status(201).json({ id_categoria: rows[0].id_categoria });
}

export async function updateCategory(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const body = categorySchema.partial().parse(req.body);
  const fields: string[] = [];
  const params: unknown[] = [id];
  for (const [col, val] of Object.entries({
    nombre: body.nombre,
    slug: body.slug,
    descripcion: body.descripcion,
    imagen_url: body.imagen_url,
    orden_visual: body.orden_visual,
    estado: body.estado,
  })) {
    if (val !== undefined) {
      params.push(val);
      fields.push(`${col} = $${params.length}`);
    }
  }
  if (!fields.length) throw new ApiError(400, "Sin campos para actualizar");
  const { rowCount } = await query(
    `update public.categorias set ${fields.join(", ")} where id_categoria = $1`,
    params
  );
  if (!rowCount) throw new ApiError(404, "Categoría no encontrada");
  res.json({ ok: true });
}

export async function deleteCategory(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  // Los productos con esta categoría pasan a no tener categoría (on delete set null)
  const { rowCount } = await query("delete from public.categorias where id_categoria = $1", [id]);
  if (!rowCount) throw new ApiError(404, "Categoría no encontrada");
  res.json({ ok: true });
}
