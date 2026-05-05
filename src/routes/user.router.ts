import { Router } from "express";
import { createAdmin, addFaculty, addStaff } from "../controllers/user.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/admin", verifyToken, isAdmin, createAdmin);
router.post("/faculty", verifyToken, isAdmin, addFaculty);
router.post("/staff", verifyToken, isAdmin, addStaff);

export default router;
