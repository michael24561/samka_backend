import type { Request, Response } from "express";
import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import { updateUsuarioSchema, metodoPagoSchema } from "../lib/validators/admin.js";

/* =========================================================
   USUARIOS
   ========================================================= */
export async function listUsuarios(_req: Request, res: Response) {
  const { rows } = await query(
    `select u.id_usuario, u.correo, u.nombre, u.apellido, u.telefono, u.imagen_perfil,
            u.estado, u.fecha_registro, r.nombre as rol, r.id_rol
     from public.usuarios u
     join public.roles_usuario r on r.id_rol = u.id_rol
     order by u.fecha_registro desc`
  );
  res.json({ usuarios: rows });
}

export async function listRoles(_req: Request, res: Response) {
  const { rows } = await query(
    "select id_rol, nombre, descripcion from public.roles_usuario order by nombre"
  );
  res.json({ roles: rows });
}

export async function updateUsuario(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const body = updateUsuarioSchema.parse(req.body);
  if (body.id_rol) {
    const role = await query("select id_rol from public.roles_usuario where id_rol = $1", [
      body.id_rol,
    ]);
    if (!role.rowCount) throw new ApiError(400, "Rol no válido");
  }
  const fields: string[] = ["fecha_actualizacion = now()"];
  const params: unknown[] = [id];
  for (const [col, val] of Object.entries({
    id_rol: body.id_rol,
    estado: body.estado,
    nombre: body.nombre,
    apellido: body.apellido,
    telefono: body.telefono,
  })) {
    if (val !== undefined) {
      params.push(val);
      fields.push(`${col} = $${params.length}`);
    }
  }
  const { rowCount } = await query(
    `update public.usuarios set ${fields.join(", ")} where id_usuario = $1`,
    params
  );
  if (!rowCount) throw new ApiError(404, "Usuario no encontrado");
  res.json({ ok: true });
}

/* =========================================================
   METODOS DE PAGO
   ========================================================= */
export async function listMetodosPagoAdmin(_req: Request, res: Response) {
  const { rows } = await query(
    `select m.id_metodo_pago, m.nombre, m.descripcion, m.activo,
            (select count(*)::int from public.pagos p where p.id_metodo_pago = m.id_metodo_pago) as cantidad_pagos
     from public.metodos_pago m
     order by m.nombre`
  );
  res.json({ metodos_pago: rows });
}

export async function createMetodoPago(req: Request, res: Response) {
  const body = metodoPagoSchema.parse(req.body);
  const { rows } = await query<{ id_metodo_pago: string }>(
    `insert into public.metodos_pago (nombre, descripcion, activo)
     values ($1, $2, $3) returning id_metodo_pago`,
    [body.nombre, body.descripcion ?? null, body.activo]
  );
  res.status(201).json({ id_metodo_pago: rows[0].id_metodo_pago });
}

export async function updateMetodoPago(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const body = metodoPagoSchema.partial().parse(req.body);
  const fields: string[] = [];
  const params: unknown[] = [id];
  for (const [col, val] of Object.entries({
    nombre: body.nombre,
    descripcion: body.descripcion,
    activo: body.activo,
  })) {
    if (val !== undefined) {
      params.push(val);
      fields.push(`${col} = $${params.length}`);
    }
  }
  if (!fields.length) throw new ApiError(400, "Sin campos para actualizar");
  const { rowCount } = await query(
    `update public.metodos_pago set ${fields.join(", ")} where id_metodo_pago = $1`,
    params
  );
  if (!rowCount) throw new ApiError(404, "Método de pago no encontrado");
  res.json({ ok: true });
}

export async function deleteMetodoPago(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  // Los pagos referencian id_metodo_pago (sin on delete); ocultar en lugar de borrar si hay pagos
  const used = await query("select 1 from public.pagos where id_metodo_pago = $1", [id]);
  if (used.rowCount) {
    throw new ApiError(409, "El método de pago tiene pagos asociados; inactívalo en lugar de eliminarlo");
  }
  const { rowCount } = await query("delete from public.metodos_pago where id_metodo_pago = $1", [
    id,
  ]);
  if (!rowCount) throw new ApiError(404, "Método de pago no encontrado");
  res.json({ ok: true });
}

/* =========================================================
   RESEÑAS (moderación)
   ========================================================= */
export async function listResenasAdmin(_req: Request, res: Response) {
  const { rows } = await query(
    `select r.id_resena, r.calificacion, r.comentario, r.fecha_creacion,
            u.nombre as usuario_nombre, u.correo as usuario_correo, u.imagen_perfil,
            p.nombre as producto_nombre, p.slug as producto_slug, p.id_producto
     from public.resenas r
     join public.usuarios u on u.id_usuario = r.id_usuario
     left join public.productos p on p.id_producto = r.id_producto
     order by r.fecha_creacion desc`
  );
  res.json({ resenas: rows });
}

export async function deleteResena(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { rowCount } = await query("delete from public.resenas where id_resena = $1", [id]);
  if (!rowCount) throw new ApiError(404, "Reseña no encontrada");
  res.json({ ok: true });
}

/* =========================================================
   DIRECCIONES (visualización admin)
   ========================================================= */
export async function listDireccionesAdmin(_req: Request, res: Response) {
  const { rows } = await query(
    `select d.*, u.nombre as usuario_nombre, u.correo as usuario_correo
     from public.direcciones d
     join public.usuarios u on u.id_usuario = d.id_usuario
     order by u.nombre, d.predeterminada desc`
  );
  res.json({ direcciones: rows });
}

/* =========================================================
   EXPORTAR REPORTES (CSV)
   ========================================================= */
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportarReportesCsv(_req: Request, res: Response) {
  // Resumen por estado
  const estados = await query(
    `select estado, count(*)::int as cantidad, coalesce(sum(total),0)::numeric as total
     from public.pedidos group by estado order by estado`
  );

  // Pedidos (detalle de ventas)
  const pedidos = await query(
    `select p.fecha_pedido, p.estado, p.nombre_destinatario, p.correo,
            p.total, p.costo_envio, p.subtotal,
            coalesce(mp.nombre, '') as metodo_pago, coalesce(pa.referencia_transaccion, '') as referencia
     from public.pedidos p
     left join public.pagos pa on pa.id_pedido = p.id_pedido
     left join public.metodos_pago mp on mp.id_metodo_pago = pa.id_metodo_pago
     order by p.fecha_pedido desc`
  );

  const lines: string[] = [];
  lines.push("Resumen de pedidos por estado");
  lines.push([
    "estado",
    "cantidad",
    "total",
  ]
    .map(csvEscape)
    .join(","));
  for (const r of estados.rows) {
    lines.push([r.estado, r.cantidad, r.total].map(csvEscape).join(","));
  }
  lines.push("");
  lines.push("Detalle de pedidos");
  lines.push(
    [
      "fecha",
      "estado",
      "destinatario",
      "correo",
      "subtotal",
      "costo_envio",
      "total",
      "metodo_pago",
      "referencia",
    ]
      .map(csvEscape)
      .join(",")
  );
  for (const r of pedidos.rows) {
    lines.push(
      [
        r.fecha_pedido,
        r.estado,
        r.nombre_destinatario,
        r.correo,
        r.subtotal,
        r.costo_envio,
        r.total,
        r.metodo_pago,
        r.referencia,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  const csv = "\uFEFF" + lines.join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="samka-reporte-${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.status(200).send(csv);
}
