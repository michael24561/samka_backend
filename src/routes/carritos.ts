import { Router } from "express";
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from "../controllers/carritoController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();

router.get("/", requireAuth, asyncHandler(getCart));
router.post("/items", requireAuth, asyncHandler(addToCart));
router.put("/items/:id", requireAuth, asyncHandler(updateCartItem));
router.delete("/items/:id", requireAuth, asyncHandler(removeFromCart));
router.delete("/", requireAuth, asyncHandler(clearCart));

export default router;
