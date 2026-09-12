import { z } from "zod";

export const orderItemInput = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.coerce.number().int().min(1),
  precio_unitario: z.coerce.number().min(0),
  personalizacion: z.record(z.unknown()).optional().default({}),
});

export const orderCreateSchema = z.object({
  id_direccion: z.string().uuid().optional().nullable(),
  nombre_destinatario: z.string().min(1, "El nombre es requerido"),
  telefono: z.string().min(1),
  correo: z.string().email(),
  direccion_envio: z.string().min(1, "La dirección es requerida"),
  distrito_envio: z.string().optional().nullable(),
  provincia_envio: z.string().optional().nullable(),
  departamento_envio: z.string().optional().nullable(),
  codigo_postal_envio: z.string().optional().nullable(),
  referencia_envio: z.string().optional().nullable(),
  lat_envio: z.coerce.number().optional().nullable(),
  lng_envio: z.coerce.number().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  subtotal: z.coerce.number().min(0),
  descuento: z.coerce.number().min(0).default(0),
  costo_envio: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0),
  items: z.array(orderItemInput).min(1),
});

export const statusUpdateSchema = z.object({
  estado: z.enum([
    "pendiente",
    "pagado",
    "preparando",
    "enviado",
    "entregado",
    "cancelado",
  ]),
  comentario: z.string().optional().nullable(),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
