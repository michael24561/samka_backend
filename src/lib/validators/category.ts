import { z } from "zod";

export const categorySchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  slug: z.string().min(1),
  descripcion: z.string().optional().nullable(),
  imagen_url: z.string().optional().nullable(),
  orden_visual: z.coerce.number().int().min(0).default(0),
  estado: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categorySchema>;
