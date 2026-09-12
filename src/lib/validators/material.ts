import { z } from "zod";

export const materialSchema = z.object({
  name: z.string().min(1),
  unit: z.string().default("g"),
  stock: z.coerce.number().min(0).default(0),
  low_stock_threshold: z.coerce.number().min(0).default(0),
  unit_cost: z.coerce.number().min(0).default(0),
});

export const materialMovementSchema = z.object({
  quantity: z.coerce.number().positive(),
  movement_type: z.enum(["in", "out"]),
  reference: z.string().optional().nullable(),
});

export type MaterialInput = z.infer<typeof materialSchema>;
