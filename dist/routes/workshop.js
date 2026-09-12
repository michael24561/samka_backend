import { Router } from "express";
import { createError, listErrors, updateErrorStatus, } from "../controllers/workshopController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
const router = Router();
router.get("/errors", requireAuth, requireAdmin, asyncHandler(listErrors));
router.post("/errors", requireAuth, requireAdmin, asyncHandler(createError));
router.patch("/errors/:id", requireAuth, requireAdmin, asyncHandler(updateErrorStatus));
export default router;
