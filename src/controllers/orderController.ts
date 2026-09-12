import type { Request, Response } from "express";
import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import { orderCreateSchema, statusUpdateSchema } from "../lib/validators/order.js";
import { syncProfileFromCheckout } from "../lib/profile.js";
import type { AuthedRequest } from "../middleware/auth.js";

export async function cancelOrder(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const user = (req as AuthedRequest).user!;
  const { rows } = await query<{ estado: string; id_usuario: string }>(
    "select estado, id_usuario from public.pedidos where id_pedido = $1",
    [id]
  );
  const pedido = rows[0];
  if (!pedido) throw new ApiError(404, "Pedido no encontrado");
  if (user.role !== "admin" && pedido.id_usuario !== user.userId) {
    throw new ApiError(403, "No tienes acceso a este pedido");
  }
  if (pedido.estado !== "pendiente") {
    throw new ApiError(409, "Solo se pueden cancelar pedidos pendientes");
  }

  await query(
    `update public.pedidos set estado = 'cancelado', fecha_actualizacion = now() where id_pedido = $1`,
    [id]
  );
  await query(
    `insert into public.historial_estado_pedido (id_pedido, estado, comentario)
     values ($1, 'cancelado', 'Pago no completado')`,
    [id]
  );
  res.json({ ok: true });
}

export async function createOrder(req: Request, res: Response) {
  const body = orderCreateSchema.parse(req.body);
  const userId = (req as AuthedRequest).user?.userId ?? null;

  // Resolver dirección (id_direccion) si viene, o guardar histórico de envío
  let direccionId: string | null = body.id_direccion ?? null;

  // Si el usuario está logueado y no eligió una dirección guardada, buscar si ya
  // existe una igual; si no, guardar la dirección de envío en la tabla direcciones.
  if (userId && !direccionId && body.direccion_envio) {
    const existing = await query(
      `select id_direccion from public.direcciones
       where id_usuario = $1
         and lower(direccion) = lower($2)
         and coalesce(lower(distrito),'') = coalesce(lower($3),'')
         and coalesce(lower(provincia),'') = coalesce(lower($4),'')
       limit 1`,
      [userId, body.direccion_envio, body.distrito_envio ?? "", body.provincia_envio ?? ""]
    );
    if (existing.rowCount) {
      direccionId = existing.rows[0].id_direccion;
    } else {
      const isFirst = await query(
        "select 1 from public.direcciones where id_usuario = $1 limit 1",
        [userId]
      );
      const saved = await query<{ id_direccion: string }>(
        `insert into public.direcciones
           (id_usuario, nombre_destinatario, telefono, direccion, distrito, provincia,
            departamento, codigo_postal, referencia, predeterminada, lat, lng)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         returning id_direccion`,
        [
          userId,
          body.nombre_destinatario,
          body.telefono,
          body.direccion_envio,
          body.distrito_envio ?? "",
          body.provincia_envio ?? "",
          body.departamento_envio ?? "",
          body.codigo_postal_envio ?? null,
          body.referencia_envio ?? null,
          !isFirst.rowCount,
          body.lat_envio ?? null,
          body.lng_envio ?? null,
        ]
      );
      direccionId = saved.rows[0].id_direccion;
    }
  }

  const { rows } = await query<{ id_pedido: string }>(
    `insert into public.pedidos
       (id_usuario, id_direccion,
        nombre_destinatario, telefono, correo,
        direccion_envio, distrito_envio, provincia_envio, departamento_envio,
        lat, lng,
        subtotal, descuento, costo_envio, total, estado, observaciones)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pendiente',$16)
     returning id_pedido`,
    [
      userId,
      direccionId,
      body.nombre_destinatario,
      body.telefono,
      body.correo,
      body.direccion_envio,
      body.distrito_envio ?? null,
      body.provincia_envio ?? null,
      body.departamento_envio ?? null,
      body.lat_envio ?? null,
      body.lng_envio ?? null,
      body.subtotal,
      body.descuento ?? 0,
      body.costo_envio ?? 0,
      body.total,
      body.observaciones ?? null,
    ]
  );
  const pedidoId = rows[0].id_pedido;

  // Registrar items del pedido (stock se decrementa al confirmar pago)
  for (const item of body.items) {
    await query(
      `insert into public.detalle_pedido
         (id_pedido, id_producto, nombre_producto, imagen_producto, precio_unitario, cantidad, subtotal, personalizacion)
       values ($1, $2,
               (select nombre from public.productos where id_producto = $2),
               (select imagen_principal from public.productos where id_producto = $2),
               $3, $4, $5, $6)`,
      [
        pedidoId,
        item.producto_id,
        item.precio_unitario,
        item.cantidad,
        item.precio_unitario * item.cantidad,
        JSON.stringify(item.personalizacion ?? {}),
      ]
    );
  }

  // Sincronizar teléfono del checkout con el perfil del usuario
  await syncProfileFromCheckout(userId, { telefono: body.telefono });

  await query(
    `insert into public.historial_estado_pedido (id_pedido, estado, comentario)
     values ($1, 'pendiente', 'Pedido creado')`,
    [pedidoId]
  );

  res.status(201).json({ id_pedido: pedidoId });
}

export async function listOrders(req: Request, res: Response) {
  const user = (req as AuthedRequest).user!;
  let sql = `
    select p.*,
           (select count(*)::int from public.detalle_pedido dp where dp.id_pedido = p.id_pedido) as cantidad_items
    from public.pedidos p`;
  const params: unknown[] = [];
  if (user.role !== "admin") {
    params.push(user.userId);
    sql += ` where p.id_usuario = $1`;
  }
  sql += ` order by p.fecha_pedido desc`;
  const { rows } = await query(sql, params);

  const detailed = await Promise.all(
    rows.map(async (p) => {
      const [items, history, payment] = await Promise.all([
        query("select * from public.detalle_pedido where id_pedido = $1", [p.id_pedido]),
        query(
          "select * from public.historial_estado_pedido where id_pedido = $1 order by fecha_creacion desc",
          [p.id_pedido]
        ),
        query("select * from public.pagos where id_pedido = $1", [p.id_pedido]),
      ]);
      return {
        ...p,
        items: items.rows,
        history: history.rows,
        payment: payment.rows[0] ?? null,
      };
    })
  );

  res.json({ pedidos: detailed });
}

export async function updateOrderStatus(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const body = statusUpdateSchema.parse(req.body);
  const { rows } = await query<{ estado: string }>(
    `update public.pedidos set estado = $2, fecha_actualizacion = now() where id_pedido = $1 returning estado`,
    [id, body.estado]
  );
  if (!rows[0]) throw new ApiError(404, "Pedido no encontrado");

  await query(
    `insert into public.historial_estado_pedido (id_pedido, estado, comentario)
     values ($1, $2, $3)`,
    [id, body.estado, body.comentario ?? null]
  );

  res.json({ ok: true, estado: rows[0].estado });
}
