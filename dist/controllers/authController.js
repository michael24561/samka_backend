import { query } from "../db.js";
import { comparePassword, hashPassword } from "../lib/password.js";
import { signToken } from "../lib/jwt.js";
import { ApiError } from "../middleware/error.js";
import { loginSchema, registerSchema } from "../lib/validators/auth.js";
export async function register(req, res) {
    const body = registerSchema.parse(req.body);
    const existing = await query("select id from public.users where email = $1", [
        body.email.toLowerCase(),
    ]);
    if (existing.rowCount) {
        throw new ApiError(409, "El email ya está registrado");
    }
    const passwordHash = await hashPassword(body.password);
    const { rows } = await query(`insert into public.users (email, password_hash, full_name, phone)
     values ($1, $2, $3, $4)
     returning id`, [body.email.toLowerCase(), passwordHash, body.full_name ?? null, body.phone ?? null]);
    const userId = rows[0].id;
    await query(`insert into public.user_roles (user_id, role) values ($1, 'customer')
     on conflict (user_id, role) do nothing`, [userId]);
    res.status(201).json({ message: "Usuario creado", userId });
}
export async function login(req, res) {
    const body = loginSchema.parse(req.body);
    const { rows } = await query(`select u.id, u.email, u.password_hash,
            coalesce((select ur.role from public.user_roles ur
                      where ur.user_id = u.id and ur.role = 'admin' limit 1), 'customer') as role
     from public.users u
     where u.email = $1`, [body.email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await comparePassword(body.password, user.password_hash))) {
        throw new ApiError(401, "Credenciales inválidas");
    }
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
}
export async function me(req, res) {
    const userId = req.user?.userId;
    const { rows } = await query(`select u.id, u.email, u.full_name, u.phone, u.created_at,
            ur.role
     from public.users u
     left join lateral (
       select ur2.role from public.user_roles ur2 where ur2.user_id = u.id and ur2.role = 'admin' limit 1
     ) ur on true
     where u.id = $1`, [userId]);
    if (!rows[0])
        throw new ApiError(404, "Usuario no encontrado");
    res.json({ user: rows[0] });
}
