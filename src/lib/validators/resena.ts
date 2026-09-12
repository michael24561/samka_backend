import { z } from "zod";

export const resenaSchema = z.object({
  calificacion: z.coerce.number().int().min(1).max(5),
  comentario: z.string().optional().nullable(),
});

export type ResenaInput = z.infer<typeof resenaSchema>;
