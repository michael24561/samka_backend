import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import { materialSchema } from "../lib/validators/material.js";
export async function listMaterials(_req, res) {
    const { rows } = await query(`select m.*,
            m.stock <= m.low_stock_threshold and m.stock > 0 as low,
            m.stock = 0 as out_of_stock
     from public.materials m
     order by m.name`);
    res.json({ materials: rows });
}
export async function createMaterial(req, res) {
    const body = materialSchema.parse(req.body);
    const { rows } = await query(`insert into public.materials (name, unit, stock, low_stock_threshold, unit_cost)
     values ($1,$2,$3,$4,$5) returning id`, [body.name, body.unit, body.stock, body.low_stock_threshold, body.unit_cost]);
    await checkAndLogStockAlert("material", rows[0].id, body.name, body.stock, body.low_stock_threshold);
    res.status(201).json({ id: rows[0].id });
}
export async function updateMaterial(req, res) {
    const { id } = req.params;
    const body = materialSchema.partial().parse(req.body);
    const fields = [];
    const params = [id];
    for (const [col, val] of Object.entries({
        name: body.name,
        unit: body.unit,
        stock: body.stock,
        low_stock_threshold: body.low_stock_threshold,
        unit_cost: body.unit_cost,
    })) {
        if (val !== undefined) {
            params.push(val);
            fields.push(`${col} = $${params.length}`);
        }
    }
    if (!fields.length)
        throw new ApiError(400, "Sin campos para actualizar");
    const { rows } = await query(`update public.materials set ${fields.join(", ")} where id = $1
     returning name, stock, low_stock_threshold`, params);
    if (!rows[0])
        throw new ApiError(404, "Material no encontrado");
    await checkAndLogStockAlert("material", id, rows[0].name, rows[0].stock, rows[0].low_stock_threshold);
    res.json({ ok: true });
}
export async function registerMovement(req, res) {
    const { id } = req.params;
    const { quantity, movement_type, reference } = req.body;
    const sign = movement_type === "in" ? 1 : -1;
    const { rows } = await query(`update public.materials m
     set stock = greatest(0, m.stock + ($1 * $2::numeric))
     where m.id = $3
     returning name, stock`, [quantity, sign, id]);
    const mat = rows[0];
    if (!mat)
        throw new ApiError(404, "Material no encontrado");
    await query(`insert into public.material_movements (material_id, quantity, movement_type, reference)
     values ($1, $2, $3, $4)`, [id, quantity, movement_type, reference ?? null]);
    const mat2 = await query("select low_stock_threshold from public.materials where id = $1", [id]);
    await checkAndLogStockAlert("material", id, mat.name, mat.stock, mat2.rows[0]?.low_stock_threshold ?? 0);
    res.json({ material: mat });
}
export async function listAlerts(_req, res) {
    const { rows } = await query(`select * from public.stock_alerts where resolved = false order by created_at desc`);
    res.json({ alerts: rows });
}
async function checkAndLogStockAlert(scope, refId, refName, currentStock, threshold) {
    if (currentStock <= threshold) {
        await query(`insert into public.stock_alerts (scope, ref_id, ref_name, current_stock, threshold)
       values ($1, $2, $3, $4, $5)`, [scope, refId, refName, currentStock, threshold]);
    }
    // resolver alertas previas si el stock volvió a ser suficiente
    await query(`update public.stock_alerts
     set resolved = true, resolved_at = now()
     where ref_id = $1 and resolved = false and $2 > threshold`, [refId, currentStock]);
}
