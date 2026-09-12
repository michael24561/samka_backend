import { z } from "zod";

export const updateUsuarioSchema = z
  .object({
    id_rol: z.string().uuid().optional(),
    estado: z.boolean().optional(),
    nombre: z.string().min(1).optional(),
    apellido: z.string().nullable().optional(),
    telefono: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Sin campos para actualizar" });

export const metodoPagoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().nullable().optional(),
  activo: z.boolean().default(true),
});

export type UpdateUsuarioInput = z.infer<typeof updateUsuarioSchema>;
export type MetodoPagoInput = z.infer<typeof metodoPagoSchema>;
