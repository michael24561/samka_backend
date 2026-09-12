import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import { checkoutSchema } from "../lib/validators/payment.js";
export async function checkout(req, res) {
    const body = checkoutSchema.parse(req.body);
    const { rows } = await query("select total, status from public.orders where id = $1", [body.order_id]);
    const order = rows[0];
    if (!order)
        throw new ApiError(404, "Pedido no encontrado");
    if (order.status !== "pending") {
        throw new ApiError(409, "El pedido ya fue pagado o procesado");
    }
    // Simulación de pasarela — siempre "autoriza". En producción se integraría
    // la pasarela real (Culqi/Niubiz/etc.) en este punto.
    await new Promise((r) => setTimeout(r, 600));
    const { rows: payRows } = await query(`insert into public.payments (order_id, amount, method, status)
     values ($1, $2, $3, 'success')
     returning transaction_ref`, [body.order_id, order.total, body.method]);
    await query(`update public.orders set status = 'paid', payment_method = $2, updated_at = now() where id = $1`, [body.order_id, body.method]);
    await query(`insert into public.order_status_history (order_id, status, note)
     values ($1, 'paid', 'Pago confirmado')`, [body.order_id]);
    res.json({
        success: true,
        transaction_ref: payRows[0].transaction_ref,
        message: "Pago simulado autorizado",
    });
}
