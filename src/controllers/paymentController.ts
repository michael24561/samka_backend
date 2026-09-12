import type { Request, Response } from "express";
import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import { checkoutSchema } from "../lib/validators/payment.js";

function codigoRef() {
  return "TXN-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 9000 + 1000);
}

export async function listMetodosPago(_req: Request, res: Response) {
  const { rows } = await query(
    "select * from public.metodos_pago where activo = true order by nombre"
  );
  res.json({ metodos: rows });
}

export async function checkout(req: Request, res: Response) {
  const body = checkoutSchema.parse(req.body);

  const { rows } = await query<{ total: number; estado: string }>(
    "select total, estado from public.pedidos where id_pedido = $1",
    [body.pedido_id]
  );
  const pedido = rows[0];
  if (!pedido) throw new ApiError(404, "Pedido no encontrado");
  if (pedido.estado !== "pendiente") {
    throw new ApiError(409, "El pedido ya fue pagado o procesado");
  }

  // Resolver método de pago
  const metodo = await query(
    "select id_metodo_pago from public.metodos_pago where lower(nombre) = lower($1)",
    [body.metodo_nombre]
  );
  if (!metodo.rowCount) throw new ApiError(400, "Método de pago no válido");
  const metodoId = metodo.rows[0].id_metodo_pago;

  // Simulación de pasarela — siempre "autoriza"
  await new Promise((r) => setTimeout(r, 600));

  const { rows: payRows } = await query<{ referencia_transaccion: string }>(
    `insert into public.pagos (id_pedido, id_metodo_pago, monto, estado, referencia_transaccion)
     values ($1, $2, $3, 'completado', $4)
     returning referencia_transaccion`,
    [body.pedido_id, metodoId, pedido.total, codigoRef()]
  );

  await query(
    `update public.pedidos set estado = 'pagado', fecha_actualizacion = now() where id_pedido = $1`,
    [body.pedido_id]
  );
  await query(
    `insert into public.historial_estado_pedido (id_pedido, estado, comentario)
     values ($1, 'pagado', 'Pago confirmado')`,
    [body.pedido_id]
  );

  // Decrementar stock solo al confirmar pago
  const items = await query(
    "select id_producto, cantidad from public.detalle_pedido where id_pedido = $1",
    [body.pedido_id]
  );
  for (const item of items.rows) {
    await query(
      "update public.productos set stock = greatest(0, stock - $2), fecha_actualizacion = now() where id_producto = $1",
      [item.id_producto, item.cantidad]
    );
  }

  res.json({
    success: true,
    referencia_transaccion: payRows[0].referencia_transaccion,
    message: "Pago simulado autorizado",
  });
}
