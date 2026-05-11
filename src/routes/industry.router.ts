import { Router } from "express";
import { createIndustry, updateIndustry, getIndustries } from "../controllers/industry.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", verifyToken, isAdmin, createIndustry);
router.patch("/:industryId", verifyToken, isAdmin, updateIndustry);
router.get("/getIndustries", verifyToken, getIndustries)

export default router;
