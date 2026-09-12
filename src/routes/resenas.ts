import { Router } from "express";
import { listResenas, createResena } from "../controllers/resenaController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();

router.get("/producto/:productoId", asyncHandler(listResenas));
router.post("/producto/:productoId", requireAuth, asyncHandler(createResena));

export default router;
