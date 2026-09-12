import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../env.js";
import { ApiError } from "../middleware/error.js";
import { query } from "../db.js";
import { orderCreateSchema } from "../lib/validators/order.js";
import { syncProfileFromCheckout } from "../lib/profile.js";
import type { AuthedRequest } from "../middleware/auth.js";

const MP_API = "https://api.mercadopago.com";

type MPPayment = {
  id: number;
  status: string;
  status_detail: string;
  external_reference?: string | null;
  transaction_amount?: number;
};

async function mpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.mercadoPagoAccessToken}`,
      ...(init.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(
      res.status,
      `Error de Mercado Pago: ${(data as { message?: string }).message ?? res.statusText}`
    );
  }
  return data as T;
}

/**
 * Crea una quote temporal con los datos del carrito y genera la preferencia MP.
 * NO crea pedido ni toca stock.
 */
export async function createPreference(req: Request, res: Response) {
  if (!env.mercadoPagoAccessToken) {
    throw new ApiError(503, "Pasarela de pago no configurada");
  }
  const body = orderCreateSchema.parse(req.body);
  const userId = (req as AuthedRequest).user?.userId ?? null;

  const quote = await query<{ id_quote: string }>(
    `insert into public.quotes
       (id_usuario, correo, datos_envio, items, subtotal, descuento, costo_envio, total)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id_quote`,
    [
      userId,
      body.correo,
      JSON.stringify({
        nombre_destinatario: body.nombre_destinatario,
        telefono: body.telefono,
        direccion_envio: body.direccion_envio,
        distrito_envio: body.distrito_envio,
        provincia_envio: body.provincia_envio,
        departamento_envio: body.departamento_envio,
        codigo_postal_envio: body.codigo_postal_envio,
        referencia_envio: body.referencia_envio,
        lat_envio: body.lat_envio,
        lng_envio: body.lng_envio,
        observaciones: body.observaciones,
      }),
      JSON.stringify(body.items),
      body.subtotal,
      body.descuento ?? 0,
      body.costo_envio ?? 0,
      body.total,
    ]
  );
  const quoteId = quote.rows[0].id_quote;

  const mpItems = body.items.map((it) => ({
    title: `Pedido Samka`,
    description: `Pedido Samka Jewels`,
    quantity: it.cantidad,
    unit_price: it.precio_unitario,
    currency_id: "PEN",
    category_id: "samka_jewels",
  }));

  const notificationUrl = env.mercadoPagoWebhookUrl
    ? `${env.mercadoPagoWebhookUrl}/api/payments/webhook`
    : undefined;

  const pref = await mpFetch<{ id: string; init_point: string }>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: mpItems,
      external_reference: quoteId,
      payer: { email: body.correo },
      back_urls: {
        success: `${env.clientOrigin}/checkout?pago=ok&quote=${quoteId}`,
        pending: `${env.clientOrigin}/checkout?pago=pending&quote=${quoteId}`,
        failure: `${env.clientOrigin}/checkout?pago=fail&quote=${quoteId}`,
      },
      payment_methods: { installments: 12 },
      statement_descriptor: "SAMKA JEWELS",
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    }),
  });

  res.json({ preference_id: pref.id, init_point: pref.init_point, quote_id: quoteId });
}

/**
 * Webhook de Mercado Pago. Al recibir pago aprobado, crea el pedido desde la quote.
 */
export async function handleWebhook(req: Request, res: Response) {
  res.json({ received: true });

  if (!env.mercadoPagoAccessToken) return;

  const notif = req.body as { type?: string; data?: { id?: string | number } };
  const paymentId =
    typeof notif?.data?.id === "string" || typeof notif?.data?.id === "number"
      ? notif.data.id
      : null;
  if (!paymentId || notif.type !== "payment") return;

  try {
    const payment = await mpFetch<MPPayment>(`/v1/payments/${paymentId}`);
    const quoteId = payment.external_reference;
    if (!quoteId) return;

    if (payment.status === "approved") {
      await createOrderFromQuote(quoteId, `MP-${payment.id}`);
    } else if (
      payment.status === "rejected" ||
      payment.status === "cancelled" ||
      payment.status === "expired"
    ) {
      await query(
        `update public.quotes set estado = 'cancelado' where id_quote = $1`,
        [quoteId]
      );
    }
  } catch {
    /* errores de webhook se ignoran */
  }
}

/**
 * Crea un pedido completo desde una quote. Idempotente — si ya existe pedido para esa quote, no duplica.
 */
async function createOrderFromQuote(quoteId: string, referencia: string) {
  // Verificar si ya se creó pedido para esta quote (idempotente)
  const quoteQ = await query(
    "select * from public.quotes where id_quote = $1 and estado = 'pendiente'",
    [quoteId]
  );
  if (!quoteQ.rowCount) return;
  const quote = quoteQ.rows[0];

  // Marcar quote como procesada
  await query(
    `update public.quotes set estado = 'procesado' where id_quote = $1`,
    [quoteId]
  );

  const envio = quote.datos_envio as Record<string, unknown>;
  const items = quote.items as Array<{
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
    personalizacion?: Record<string, unknown>;
  }>;

  // Guardar dirección si hay usuario (reutiliza si ya existe una igual)
  let direccionId: string | null = null;
  if (quote.id_usuario) {
    const existing = await query(
      `select id_direccion from public.direcciones
       where id_usuario = $1
         and lower(direccion) = lower($2)
         and coalesce(lower(distrito),'') = coalesce(lower($3),'')
         and coalesce(lower(provincia),'') = coalesce(lower($4),'')
       limit 1`,
      [quote.id_usuario, envio.direccion_envio, envio.distrito_envio ?? "", envio.provincia_envio ?? ""]
    );
    if (existing.rowCount) {
      direccionId = existing.rows[0].id_direccion;
    } else {
      const isFirst = await query(
        "select 1 from public.direcciones where id_usuario = $1 limit 1",
        [quote.id_usuario]
      );
      const saved = await query<{ id_direccion: string }>(
        `insert into public.direcciones
           (id_usuario, nombre_destinatario, telefono, direccion, distrito, provincia,
            departamento, codigo_postal, referencia, predeterminada, lat, lng)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         returning id_direccion`,
        [
          quote.id_usuario,
          envio.nombre_destinatario,
          envio.telefono,
          envio.direccion_envio,
          envio.distrito_envio ?? "",
          envio.provincia_envio ?? "",
          envio.departamento_envio ?? "",
          envio.codigo_postal_envio ?? null,
          envio.referencia_envio ?? null,
          !isFirst.rowCount,
          envio.lat_envio ?? null,
          envio.lng_envio ?? null,
        ]
      );
      direccionId = saved.rows[0].id_direccion;
    }
  }

  // Crear pedido
  const { rows } = await query<{ id_pedido: string }>(
    `insert into public.pedidos
       (id_usuario, id_direccion,
        nombre_destinatario, telefono, correo,
        direccion_envio, distrito_envio, provincia_envio, departamento_envio,
        lat, lng,
        subtotal, descuento, costo_envio, total, estado, observaciones)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pagado',$16)
     returning id_pedido`,
    [
      quote.id_usuario,
      direccionId,
      envio.nombre_destinatario,
      envio.telefono,
      quote.correo,
      envio.direccion_envio,
      envio.distrito_envio ?? null,
      envio.provincia_envio ?? null,
      envio.departamento_envio ?? null,
      envio.lat_envio ?? null,
      envio.lng_envio ?? null,
      quote.subtotal,
      quote.descuento,
      quote.costo_envio,
      quote.total,
      envio.observaciones ?? null,
    ]
  );
  const pedidoId = rows[0].id_pedido;

  // Insertar items + decrementar stock
  for (const item of items) {
    await query(
      "update public.productos set stock = greatest(0, stock - $2), fecha_actualizacion = now() where id_producto = $1",
      [item.producto_id, item.cantidad]
    );
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

  // Registrar pago completado
  const metodo = await query(
    "select id_metodo_pago from public.metodos_pago where lower(nombre) = 'mercadopago'"
  );
  const metodoId = metodo.rowCount ? metodo.rows[0].id_metodo_pago : null;

  await query(
    `insert into public.pagos (id_pedido, id_metodo_pago, monto, estado, referencia_transaccion)
     values ($1, $2, $3, 'completado', $4)`,
    [pedidoId, metodoId, quote.total, referencia]
  );

  // Historial
  await query(
    `insert into public.historial_estado_pedido (id_pedido, estado, comentario)
     values ($1, 'pagado', 'Pago confirmado por Mercado Pago')`,
    [pedidoId]
  );

  // Limpiar carrito del usuario (los items ya pasaron al pedido)
  if (quote.id_usuario) {
    await query(
      `delete from public.detalle_carrito dc
       using public.carritos c
       where c.id_carrito = dc.id_carrito and c.id_usuario = $1`,
      [quote.id_usuario]
    );
  }

  // Sincronizar teléfono del checkout con el perfil del usuario
  await syncProfileFromCheckout(quote.id_usuario, { telefono: envio.telefono as string });
}
