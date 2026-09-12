import type { Request, Response } from "express";
import { query } from "../db.js";

export async function financialReports(_req: Request, res: Response) {
  // Totales por estado
  const total = await query<{ estado: string; count: string; sum: string }>(
    `select estado, count(*)::text as count, coalesce(sum(total),0)::text as sum
     from public.pedidos group by estado`
  );

  // Ingresos totales (pedidos pagados o posteriores)
  const revenue = await query<{ total: string; count: string }>(
    `select coalesce(sum(total),0)::text as total, count(*)::text as count
     from public.pedidos where estado in ('pagado','preparando','enviado','entregado')`
  );

  // Ventas por mes (últimos 6)
  const monthly = await query(
    `select to_char(fecha_pedido, 'YYYY-MM') as month,
      count(*)::text as count, coalesce(sum(total),0)::text as revenue
      from public.pedidos
      where fecha_pedido >= now() - interval '6 months'
      group by month order by month`
  );

  // Productos con stock bajo
  const lowStock = await query(
    `select nombre, stock, stock_minimo from public.productos
     where stock <= stock_minimo and estado = true order by stock`
  );

  // Valor de inventario de productos
  const inventoryValue = await query<{ total: string }>(
    `select coalesce(sum(stock * precio),0)::text as total from public.productos`
  );

  res.json({
    totalsByStatus: total.rows,
    revenue: revenue.rows[0],
    monthly: monthly.rows,
    lowStock: lowStock.rows,
    inventoryValue: inventoryValue.rows[0]?.total ?? "0",
  });
}
