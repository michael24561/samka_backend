import { Router } from "express";
import { financialReports } from "../controllers/dashboardController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
const router = Router();
router.get("/reports", requireAuth, requireAdmin, asyncHandler(financialReports));
export default router;
