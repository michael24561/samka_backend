import { z } from "zod";
export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    full_name: z.string().min(1, "El nombre es requerido").optional(),
    phone: z.string().optional(),
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
