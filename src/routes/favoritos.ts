import { Router } from "express";
import { listFavoritos, addFavorito, removeFavorito } from "../controllers/favoritoController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();

router.get("/", requireAuth, asyncHandler(listFavoritos));
router.post("/", requireAuth, asyncHandler(addFavorito));
router.delete("/:producto_id", requireAuth, asyncHandler(removeFavorito));

export default router;
