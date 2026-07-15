import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";
const router = Router();
router.get("/stats", verifyToken, isAdmin, getDashboardStats);
export default router;
