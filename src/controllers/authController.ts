import type { Request, Response } from "express";
import { query } from "../db.js";
import { comparePassword, hashPassword } from "../lib/password.js";
import { signToken } from "../lib/jwt.js";
import { ApiError } from "../middleware/error.js";
import { loginSchema, registerSchema, updateProfileSchema } from "../lib/validators/auth.js";
import type { AuthedRequest } from "../middleware/auth.js";

export async function register(req: Request, res: Response) {
  const body = registerSchema.parse(req.body);
  const existing = await query("select id_usuario from public.usuarios where correo = $1", [
    body.email.toLowerCase(),
  ]);
  if (existing.rowCount) {
    throw new ApiError(409, "El correo ya está registrado");
  }

  const role = await query("select id_rol from public.roles_usuario where nombre = 'cliente'");
  if (!role.rowCount) throw new ApiError(500, "Rol por defecto no configurado");
  const roleId = role.rows[0].id_rol;

  const passwordHash = await hashPassword(body.password);
  const { rows } = await query<{ id_usuario: string }>(
    `insert into public.usuarios (id_rol, correo, contrasena_hash, nombre, apellido, telefono)
     values ($1, $2, $3, $4, $5, $6)
     returning id_usuario`,
    [
      roleId,
      body.email.toLowerCase(),
      passwordHash,
      body.nombre,
      body.apellido ?? null,
      body.telefono ?? null,
    ]
  );
  const userId = rows[0].id_usuario;

  await query(
    `insert into public.carritos (id_usuario) values ($1)
     on conflict (id_usuario) do nothing`,
    [userId]
  );

  res.status(201).json({ message: "Usuario creado", id_usuario: userId });
}

export async function login(req: Request, res: Response) {
  const body = loginSchema.parse(req.body);
  const { rows } = await query<{
    id_usuario: string;
    correo: string;
    contrasena_hash: string;
    rol: string;
    estado: boolean;
  }>(
    `select u.id_usuario, u.correo, u.contrasena_hash, u.estado, r.nombre as rol
     from public.usuarios u
     join public.roles_usuario r on r.id_rol = u.id_rol
     where u.correo = $1`,
    [body.email.toLowerCase()]
  );

  const user = rows[0];
  if (!user || !(await comparePassword(body.password, user.contrasena_hash))) {
    throw new ApiError(401, "Credenciales inválidas");
  }
  if (!user.estado) {
    throw new ApiError(403, "Usuario deshabilitado");
  }

  const token = signToken({ userId: user.id_usuario, email: user.correo, role: user.rol });
  res.json({ token, user: { id: user.id_usuario, email: user.correo, role: user.rol } });
}

export async function me(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user?.userId;
  const { rows } = await query(
    `select u.id_usuario, u.correo, u.nombre, u.apellido, u.telefono, u.imagen_perfil,
            u.estado, u.fecha_registro, r.nombre as rol
     from public.usuarios u
     join public.roles_usuario r on r.id_rol = u.id_rol
     where u.id_usuario = $1`,
    [userId]
  );
  if (!rows[0]) throw new ApiError(404, "Usuario no encontrado");
  res.json({ user: rows[0] });
}

export async function updateProfile(req: Request, res: Response) {
  const userId = (req as AuthedRequest).user?.userId;
  const body = updateProfileSchema.parse(req.body);

  const updates: string[] = [];
  const params: unknown[] = [userId];
  if (body.nombre !== undefined) {
    params.push(body.nombre);
    updates.push(`nombre = $${params.length}`);
  }
  if (body.apellido !== undefined) {
    params.push(body.apellido);
    updates.push(`apellido = $${params.length}`);
  }
  if (body.telefono !== undefined) {
    params.push(body.telefono);
    updates.push(`telefono = $${params.length}`);
  }
  if (!updates.length) throw new ApiError(400, "No hay campos para actualizar");

  const { rows } = await query(
    `update public.usuarios set ${updates.join(", ")} where id_usuario = $1
     returning id_usuario, correo, nombre, apellido, telefono, imagen_perfil, fecha_registro`,
    params
  );
  if (!rows[0]) throw new ApiError(404, "Usuario no encontrado");
  res.json({ ok: true, user: rows[0] });
}
