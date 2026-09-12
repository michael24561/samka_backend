import { Router } from "express";
import {
  cancelOrder,
  createOrder,
  listOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();

router.post("/", requireAuth, asyncHandler(createOrder));
router.get("/", requireAuth, asyncHandler(listOrders));
router.patch("/:id/status", requireAuth, requireAdmin, asyncHandler(updateOrderStatus));
router.post("/:id/cancel", requireAuth, asyncHandler(cancelOrder));

export default router;
