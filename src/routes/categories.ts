import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "../controllers/categoryController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();

router.get("/", asyncHandler(listCategories));
router.get("/:id", asyncHandler(getCategory));

router.post("/", requireAuth, requireAdmin, asyncHandler(createCategory));
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(updateCategory));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(deleteCategory));

export default router;
