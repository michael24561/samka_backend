import type { Request, Response } from "express";
import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import { productSchema } from "../lib/validators/product.js";

export async function listProducts(req: Request, res: Response) {
  const { destacado, categoria, search } = req.query;
  const params: unknown[] = [];
  const where: string[] = [];
  if (destacado === "true") where.push("p.destacado = true");
  if (categoria) {
    params.push(categoria as string);
    where.push(`c.slug = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(p.nombre ilike $${params.length} or p.descripcion ilike $${params.length})`);
  }
  const whereSql = where.length ? "where " + where.join(" and ") : "";
  const { rows } = await query(
    `select p.*, c.nombre as categoria_nombre, c.slug as categoria_slug,
            (select ip.imagen_url from public.imagenes_producto ip
             where ip.id_producto = p.id_producto order by ip.principal desc, ip.orden_visual limit 1) as imagen_principal_aux
     from public.productos p
     left join public.categorias c on c.id_categoria = p.id_categoria
     ${whereSql}
     order by p.destacado desc, p.fecha_creacion desc`,
    params
  );
  const productos = rows.map((r) => ({
    ...r,
    imagen_principal: r.imagen_principal ?? r.imagen_principal_aux,
  }));
  res.json({ productos });
}

export async function getProduct(req: Request, res: Response) {
  const { slug } = req.params as { slug: string };
  const { rows } = await query(
    `select p.*, c.nombre as categoria_nombre, c.slug as categoria_slug
     from public.productos p
     left join public.categorias c on c.id_categoria = p.id_categoria
     where p.slug = $1`,
    [slug]
  );
  const product = rows[0];
  if (!product) throw new ApiError(404, "Producto no encontrado");

  const images = await query(
    "select * from public.imagenes_producto where id_producto = $1 order by orden_visual, principal desc",
    [product.id_producto]
  );
  res.json({
    producto: {
      ...product,
      imagen_principal: product.imagen_principal ?? images.rows[0]?.imagen_url ?? null,
      imagenes: images.rows,
    },
  });
}

export async function createProduct(req: Request, res: Response) {
  const body = productSchema.parse(req.body);
  const { rows } = await query<{ id_producto: string }>(
    `insert into public.productos
       (nombre, slug, descripcion, precio, stock, stock_minimo, id_categoria,
        material, color, peso, imagen_principal, destacado, personalizable, estado)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     returning id_producto`,
    [
      body.nombre,
      body.slug,
      body.descripcion,
      body.precio,
      body.stock,
      body.stock_minimo,
      body.id_categoria,
      body.material,
      body.color,
      body.peso,
      body.imagen_principal,
      body.destacado,
      body.personalizable,
      body.estado,
    ]
  );
  const id = rows[0].id_producto;
  if (body.imagenes?.length) {
    for (let i = 0; i < body.imagenes.length; i++) {
      await query(
        `insert into public.imagenes_producto (id_producto, imagen_url, orden_visual, principal)
         values ($1, $2, $3, $4)`,
        [id, body.imagenes[i], i, i === 0]
      );
    }
  } else if (body.imagen_principal) {
    await query(
      `insert into public.imagenes_producto (id_producto, imagen_url, orden_visual, principal)
       values ($1, $2, 0, true)`,
      [id, body.imagen_principal]
    );
  }
  res.status(201).json({ id_producto: id });
}

export async function updateProduct(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const body = productSchema.partial().parse(req.body);
  const fields: string[] = [];
  const params: unknown[] = [id];
  const fieldMap: Record<string, unknown> = {
    nombre: body.nombre,
    slug: body.slug,
    descripcion: body.descripcion,
    precio: body.precio,
    stock: body.stock,
    stock_minimo: body.stock_minimo,
    id_categoria: body.id_categoria,
    material: body.material,
    color: body.color,
    peso: body.peso,
    imagen_principal: body.imagen_principal,
    destacado: body.destacado,
    personalizable: body.personalizable,
    estado: body.estado,
  };
  for (const [col, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      params.push(val);
      fields.push(`${col} = $${params.length}`);
    }
  }
  if (fields.length) {
    const { rowCount } = await query(
      `update public.productos set ${fields.join(", ")}, fecha_actualizacion = now() where id_producto = $1`,
      params
    );
    if (!rowCount) throw new ApiError(404, "Producto no encontrado");
  }
  if (body.imagenes) {
    await query("delete from public.imagenes_producto where id_producto = $1", [id]);
    for (let i = 0; i < body.imagenes.length; i++) {
      await query(
        `insert into public.imagenes_producto (id_producto, imagen_url, orden_visual, principal)
         values ($1, $2, $3, $4)`,
        [id, body.imagenes[i], i, i === 0]
      );
    }
  }
  res.json({ ok: true });
}

export async function deleteProduct(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { rowCount } = await query("delete from public.productos where id_producto = $1", [id]);
  if (!rowCount) throw new ApiError(404, "Producto no encontrado");
  res.json({ ok: true });
}

export async function listProductImages(req: Request, res: Response) {
  const { productId } = req.params as { productId: string };
  const { rows } = await query(
    "select * from public.imagenes_producto where id_producto = $1 order by orden_visual",
    [productId]
  );
  res.json({ imagenes: rows });
}
