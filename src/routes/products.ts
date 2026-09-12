import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProductImages,
  listProducts,
  updateProduct,
} from "../controllers/productController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();

router.get("/", asyncHandler(listProducts));
router.get("/:slug", asyncHandler(getProduct));

router.post("/", requireAuth, requireAdmin, asyncHandler(createProduct));
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(updateProduct));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(deleteProduct));

router.get("/:productId/imagenes", requireAuth, requireAdmin, asyncHandler(listProductImages));

export default router;
