import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL no configurada en server/.env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const seed = readFileSync(join(__dirname, "../src/sql/seed_v2.sql"), "utf8");

try {
  await client.connect();

  // 1. Roles base
  await client.query(
    `insert into public.roles_usuario (nombre, descripcion) values
       ('admin', 'Administrador del sistema'),
       ('cliente', 'Cliente de la tienda')
     on conflict (nombre) do nothing`
  );

  // 2. Catálogo + métodos de pago + imágenes (seed_v2.sql)
  await client.query(seed);
  console.log("Catálogo, métodos de pago e imágenes sembrados.");

  // 3. Admin inicial
  const email = process.env.ADMIN_EMAIL || "admin@samka.pe";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hash = await bcrypt.hash(password, 10);

  const existing = await client.query("select u.id_usuario from public.usuarios u where u.correo = $1", [email]);
  if (existing.rowCount === 0) {
    const { rows } = await client.query(
      `insert into public.usuarios (id_rol, correo, contrasena_hash, nombre, apellido)
       select r.id_rol, $1, $2, 'Admin', 'Samka'
       from public.roles_usuario r where r.nombre = 'admin'
       returning id_usuario`,
      [email, hash]
    );
    console.log(`Admin creado: ${email} / ${password} (cámbialo en producción)`);
  } else {
    console.log(`Admin ${email} ya existe.`);
  }
} catch (err) {
  console.error("Error en seed:", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
