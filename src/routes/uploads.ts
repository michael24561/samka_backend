import { Router } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const uploadSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.string(),
  data: z.string().min(1),
});

const router = Router();

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { type, data } = uploadSchema.parse(req.body);

  const ext = MIME_EXT[type];
  if (!ext) throw new ApiError(400, `Tipo de imagen no permitido: ${type}`);

  let base64 = data;
  if (base64.startsWith("data:")) {
    const comma = base64.indexOf(",");
    if (comma === -1) throw new ApiError(400, "Datos de imagen inválidos");
    base64 = base64.slice(comma + 1);
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw new ApiError(400, "Archivo vacío");
  if (buffer.length > 8 * 1024 * 1024) {
    throw new ApiError(413, "La imagen supera el máximo de 8 MB");
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  res.status(201).json({ url: `/api/uploads/${filename}` });
});

export default router;