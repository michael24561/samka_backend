import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../env.js";
import { query } from "../db.js";
import { hashPassword } from "../lib/password.js";
import { signToken } from "../lib/jwt.js";
import { ApiError } from "../middleware/error.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

/**
 * GET /api/auth/google/url — genera la URL de autorización de Google.
 * El `state` es un JWT de corta vida que guarda el origin al que redirigir
 * después del callback (defensa básica contra CSRF en el login).
 */
export async function googleAuthUrl(req: Request, res: Response) {
  if (!env.googleClientId) {
    throw new ApiError(503, "Google OAuth no configurado");
  }

  const state = jwt.sign(
    { origin: env.clientOrigin, nonce: randomUUID() },
    env.jwtSecret,
    { expiresIn: "10m" }
  );

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.googleClientId);
  url.searchParams.set("redirect_uri", env.googleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  res.json({ url: url.toString() });
}

/**
 * GET /api/auth/google/callback — intercambia el `code` por tokens, obtiene la
 * info del usuario, lo crea (o lo reutiliza) y redirige al cliente con el JWT.
 */
export async function googleCallback(req: Request, res: Response) {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new ApiError(503, "Google OAuth no configurado");
  }

  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  if (!code || !state) {
    return res.redirect(`${env.clientOrigin}/auth?g_error=solicitud_invalida`);
  }

  let origin = env.clientOrigin;
  try {
    const decoded = jwt.verify(state, env.jwtSecret) as { origin?: string };
    if (decoded.origin) origin = decoded.origin;
  } catch {
    // state inválido/expirado: usamos el origin por defecto y Google rechazará el cambio de flujo
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: env.googleRedirectUri,
    }),
  });
  if (!tokenRes.ok) {
    return res.redirect(`${origin}/auth?g_error=token_rechazado`);
  }
  const tokens = (await tokenRes.json()) as { access_token?: string };

  const infoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token ?? ""}` },
  });
  if (!infoRes.ok) {
    return res.redirect(`${origin}/auth?g_error=usuario_no_disponible`);
  }
  const info = (await infoRes.json()) as GoogleUserInfo;

  if (!info.email || !info.email_verified) {
    return res.redirect(`${origin}/auth?g_error=email_no_verificado`);
  }

  const { rows } = await query<{ id_usuario: string; rol: string }>(
    `select u.id_usuario, r.nombre as rol
     from public.usuarios u
     join public.roles_usuario r on r.id_rol = u.id_rol
     where u.correo = $1`,
    [info.email.toLowerCase()]
  );

  let userId: string;
  let rol: string;
  if (rows[0]) {
    userId = rows[0].id_usuario;
    rol = rows[0].rol;
    // Actualizar foto si el usuario aún no tiene una
    if (info.picture) {
      await query(
        `update public.usuarios set imagen_perfil = $2, fecha_actualizacion = now()
         where id_usuario = $1 and imagen_perfil is null`,
        [userId, info.picture]
      );
    }
  } else {
    const role = await query("select id_rol from public.roles_usuario where nombre = 'cliente'");
    if (!role.rowCount) throw new ApiError(500, "Rol por defecto no configurado");
    const roleId = role.rows[0].id_rol;

    // Contraseña aleatoria: este usuario inicia sesión únicamente con Google
    const passwordHash = await hashPassword(randomUUID());

    const created = await query<{ id_usuario: string }>(
      `insert into public.usuarios
         (id_rol, correo, contrasena_hash, nombre, apellido, imagen_perfil)
       values ($1, $2, $3, $4, $5, $6)
       returning id_usuario`,
      [
        roleId,
        info.email.toLowerCase(),
        passwordHash,
        info.given_name ?? info.name ?? "Usuario",
        info.family_name ?? null,
        info.picture ?? null,
      ]
    );
    userId = created.rows[0].id_usuario;
    rol = "cliente";

    await query(
      `insert into public.carritos (id_usuario) values ($1)
       on conflict (id_usuario) do nothing`,
      [userId]
    );
  }

  const token = signToken({ userId, email: info.email.toLowerCase(), role: rol });
  res.redirect(`${origin}/auth?g_token=${encodeURIComponent(token)}`);
}