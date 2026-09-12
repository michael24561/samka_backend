import { z } from "zod";

export const productSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  slug: z.string().min(1),
  descripcion: z.string().optional().nullable(),
  precio: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0).default(0),
  stock_minimo: z.coerce.number().int().min(0).default(5),
  id_categoria: z.string().uuid().optional().nullable(),
  material: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  peso: z.coerce.number().optional().nullable(),
  imagen_principal: z.string().optional().nullable(),
  imagenes: z.array(z.string()).optional().default([]),
  destacado: z.boolean().default(false),
  personalizable: z.boolean().default(false),
  estado: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;
