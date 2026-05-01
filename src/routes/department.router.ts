import { Router } from "express";
import { addDepartment, updateDepartment } from "../controllers/department.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", verifyToken, isAdmin, addDepartment);
router.patch("/:abbreviation", verifyToken, isAdmin, updateDepartment);

export default router;