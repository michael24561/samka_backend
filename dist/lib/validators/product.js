import { z } from "zod";
export const productSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().optional().nullable(),
    price: z.coerce.number().min(0),
    stock: z.coerce.number().int().min(0).default(0),
    low_stock_threshold: z.coerce.number().int().min(0).default(5),
    category_id: z.string().uuid().optional().nullable(),
    image_url: z.string().optional().nullable(),
    gallery: z.array(z.string()).optional().default([]),
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
    is_customizable: z.boolean().default(false),
    materials: z.array(z.string()).optional().default([]),
});
export const attributeSchema = z.object({
    attribute_type: z.string().min(1),
    value: z.string().min(1),
    price_modifier: z.coerce.number().default(0),
});
