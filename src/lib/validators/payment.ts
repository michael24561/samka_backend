import { z } from "zod";

export const checkoutSchema = z.object({
  pedido_id: z.string().uuid(),
  metodo_nombre: z.enum(["Mercado Pago"]),
  card: z
    .object({
      number: z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{4}$|^\d{16}$/, "Número de tarjeta inválido"),
      holder: z.string().min(1),
      expiry: z.string().regex(/^\d{2}\/\d{2}$/, "Formato MM/AA"),
      cvc: z.string().regex(/^\d{3,4}$/, "CVC inválido"),
    })
    .optional(),
  wallet: z
    .object({
      provider: z.string().min(1),
      phone: z.string().min(1),
    })
    .optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
