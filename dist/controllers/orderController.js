import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import { orderCreateSchema, statusUpdateSchema } from "../lib/validators/order.js";
export async function createOrder(req, res) {
    const body = orderCreateSchema.parse(req.body);
    const userId = req.user?.userId ?? null;
    const { rows } = await query(`insert into public.orders
       (user_id, full_name, phone, email, address, city, notes, eco_packaging,
        subtotal, shipping, total, payment_method)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning id, order_number`, [
        userId,
        body.full_name,
        body.phone,
        body.email,
        body.address,
        body.city,
        body.notes ?? null,
        body.eco_packaging,
        body.subtotal,
        body.shipping,
        body.total,
        body.payment_method,
    ]);
    const orderId = rows[0].id;
    for (const item of body.items) {
        await query(`insert into public.order_items
         (order_id, product_id, product_name, quantity, unit_price, subtotal, selected_attributes, customization)
       values ($1, $2, (select name from public.products where id = $2), $3, $4, $5, $6, $7)`, [
            orderId,
            item.product_id,
            item.quantity,
            item.unit_price,
            item.quantity * item.unit_price,
            JSON.stringify(item.selected_attributes),
            JSON.stringify(item.customization),
        ]);
    }
    await query(`insert into public.order_status_history (order_id, status, note)
     values ($1, 'pending', 'Pedido creado')`, [orderId]);
    res.status(201).json({ id: orderId, order_number: rows[0].order_number });
}
export async function listOrders(req, res) {
    const user = req.user;
    let sql = `
    select o.*, (select count(*) from public.order_items oi where oi.order_id = o.id) as item_count
    from public.orders o`;
    const params = [];
    if (user.role !== "admin") {
        params.push(user.userId);
        sql += ` where o.user_id = $1`;
    }
    sql += ` order by o.created_at desc`;
    const { rows } = await query(sql, params);
    res.json({ orders: rows });
}
export async function getOrderByNumber(req, res) {
    const { order_number } = req.params;
    const user = req.user;
    const { rows } = await query(`select * from public.orders where order_number = $1`, [order_number]);
    const order = rows[0];
    if (!order)
        throw new ApiError(404, "Pedido no encontrado");
    if (user?.role !== "admin" && order.user_id !== user?.userId) {
        throw new ApiError(403, "No tienes acceso a este pedido");
    }
    const items = await query("select * from public.order_items where order_id = $1", [order.id]);
    const history = await query("select * from public.order_status_history where order_id = $1 order by created_at desc", [order.id]);
    const payment = await query("select * from public.payments where order_id = $1", [order.id]);
    res.json({
        order: {
            ...order,
            items: items.rows,
            history: history.rows,
            payment: payment.rows[0] ?? null,
        },
    });
}
export async function updateOrderStatus(req, res) {
    const { id } = req.params;
    const body = statusUpdateSchema.parse(req.body);
    const { rows } = await query(`update public.orders set status = $2, updated_at = now() where id = $1 returning status`, [id, body.status]);
    if (!rows[0])
        throw new ApiError(404, "Pedido no encontrado");
    await query(`insert into public.order_status_history (order_id, status, note)
     values ($1, $2, $3)`, [id, body.status, body.note ?? null]);
    res.json({ ok: true, status: rows[0].status });
}
