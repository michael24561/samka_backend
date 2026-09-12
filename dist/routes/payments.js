import { Router } from "express";
import { checkout } from "../controllers/paymentController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
const router = Router();
router.post("/checkout", requireAuth, asyncHandler(checkout));
export default router;
