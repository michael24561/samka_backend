import { z } from "zod";
export const orderItemInput = z.object({
    product_id: z.string().uuid(),
    quantity: z.coerce.number().int().min(1),
    unit_price: z.coerce.number().min(0),
    selected_attributes: z.record(z.string()).optional().default({}),
    customization: z.record(z.unknown()).optional().default({}),
});
export const orderCreateSchema = z.object({
    full_name: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email(),
    address: z.string().min(1),
    city: z.string().min(1),
    notes: z.string().optional().nullable(),
    eco_packaging: z.boolean().default(false),
    subtotal: z.coerce.number().min(0),
    shipping: z.coerce.number().default(15),
    total: z.coerce.number().min(0),
    payment_method: z.enum(["yape", "plin", "card", "mobile_wallet"]),
    items: z.array(orderItemInput).min(1),
});
export const statusUpdateSchema = z.object({
    status: z.enum([
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
    ]),
    note: z.string().optional().nullable(),
});
