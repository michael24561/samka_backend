import { Router } from "express";
import { login, me, register, updateProfile } from "../controllers/authController.js";
import { googleAuthUrl, googleCallback } from "../controllers/googleController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/google/url", asyncHandler(googleAuthUrl));
router.get("/google/callback", asyncHandler(googleCallback));
router.get("/me", requireAuth, asyncHandler(me));
router.patch("/me", requireAuth, asyncHandler(updateProfile));

export default router;
