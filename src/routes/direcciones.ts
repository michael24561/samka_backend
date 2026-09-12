import { Router } from "express";
import { listDirecciones, createDireccion, updateDireccion, deleteDireccion } from "../controllers/direccionController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();

router.use(requireAuth);
router.get("/", asyncHandler(listDirecciones));
router.post("/", asyncHandler(createDireccion));
router.put("/:id", asyncHandler(updateDireccion));
router.delete("/:id", asyncHandler(deleteDireccion));

export default router;
