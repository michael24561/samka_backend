import { z } from "zod";
export const checkoutSchema = z.object({
    order_id: z.string().uuid(),
    method: z.enum(["card", "mobile_wallet", "yape", "plin"]),
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
