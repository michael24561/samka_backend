import { z } from "zod";

export const direccionSchema = z.object({
  nombre_destinatario: z.string().min(1),
  telefono: z.string().optional().nullable(),
  direccion: z.string().min(3),
  distrito: z.string().min(2),
  provincia: z.string().min(2),
  departamento: z.string().min(2),
  codigo_postal: z.string().optional().nullable(),
  referencia: z.string().optional().nullable(),
  predeterminada: z.coerce.boolean().optional(),
  lat: z.coerce.number().optional().nullable(),
  lng: z.coerce.number().optional().nullable(),
});

export type DireccionInput = z.infer<typeof direccionSchema>;
