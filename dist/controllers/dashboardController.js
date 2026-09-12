import { query } from "../db.js";
export async function financialReports(_req, res) {
    // Totales por estado
    const total = await query(`select status, count(*)::text as count, coalesce(sum(total),0)::text as sum
     from public.orders group by status`);
    // Ingresos totales (pedidos pagados o posteriores)
    const revenue = await query(`select coalesce(sum(total),0)::text as total, count(*)::text as count
     from public.orders where status in ('paid','processing','shipped','delivered')`);
    // Ventas por mes (últimos 6)
    const monthly = await query(`select to_char(created_at, 'YYYY-MM') as month,
      count(*)::text as count, coalesce(sum(total),0)::text as revenue
      from public.orders
      where created_at >= now() - interval '6 months'
      group by month order by month`);
    // Valor de inventario de materias primas (costo)
    const materialCost = await query(`select coalesce(sum(stock * unit_cost),0)::text as total from public.materials`);
    // Productos con stock bajo
    const lowStock = await query(`select name, stock, low_stock_threshold from public.products
     where stock <= low_stock_threshold and active = true order by stock`);
    // Errores de taller abiertos
    const openErrors = await query(`select count(*)::text as count from public.workshop_errors where status = 'open'`);
    res.json({
        totalsByStatus: total.rows,
        revenue: revenue.rows[0],
        monthly: monthly.rows,
        materialCost: materialCost.rows[0]?.total ?? "0",
        lowStock: lowStock.rows,
        openErrors: openErrors.rows[0]?.count ?? "0",
    });
}
