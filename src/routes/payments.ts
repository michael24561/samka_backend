import { Router } from "express";
import { listMetodosPago, checkout } from "../controllers/paymentController.js";
import { createPreference, handleWebhook } from "../controllers/mercadopago.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();

router.get("/metodos", asyncHandler(listMetodosPago));
router.post("/checkout", requireAuth, asyncHandler(checkout));
router.post("/preference", requireAuth, asyncHandler(createPreference));
router.post("/webhook", asyncHandler(handleWebhook));

export default router;
