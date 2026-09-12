import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
export async function listErrors(_req, res) {
    const { rows } = await query("select * from public.workshop_errors order by created_at desc");
    res.json({ errors: rows });
}
export async function createError(req, res) {
    const { description, error_type } = req.body;
    if (!description || !description.trim()) {
        throw new ApiError(400, "La descripción es requerida");
    }
    const { rows } = await query(`insert into public.workshop_errors (description, error_type) values ($1, $2) returning id`, [description, error_type ?? null]);
    res.status(201).json({ id: rows[0].id });
}
export async function updateErrorStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    if (!["open", "resolved"].includes(status)) {
        throw new ApiError(400, "Estado inválido");
    }
    const { rowCount } = await query(`update public.workshop_errors set status = $2, updated_at = now() where id = $1`, [id, status]);
    if (!rowCount)
        throw new ApiError(404, "Error de taller no encontrado");
    res.json({ ok: true });
}
