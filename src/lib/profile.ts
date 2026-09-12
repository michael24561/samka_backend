import { query } from "../db.js";

// Sincroniza datos del checkout con el perfil del usuario.
// Solo actualiza cuando el usuario está autenticado y el valor cambió.
export async function syncProfileFromCheckout(
  userId: string | null,
  data: { telefono?: string | null }
) {
  if (!userId) return;
  const telefono = data.telefono?.trim();
  if (!telefono) return;

  await query(
    `update public.usuarios
     set telefono = $2, fecha_actualizacion = now()
     where id_usuario = $1
       and (telefono is null or telefono <> $2)`,
    [userId, telefono]
  );
}