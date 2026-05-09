import { Router } from "express";
import { createIndustry, updateIndustry } from "../controllers/industry.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", verifyToken, isAdmin, createIndustry);
router.patch("/:industryId", verifyToken, isAdmin, updateIndustry);

export default router;
