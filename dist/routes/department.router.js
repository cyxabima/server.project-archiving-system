import { Router } from "express";
import { addDepartment, updateDepartment, getDepartments, deleteDepartment } from "../controllers/department.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";
const router = Router();
router.post("/", verifyToken, isAdmin, addDepartment);
router.patch("/:abbreviation", verifyToken, isAdmin, updateDepartment);
router.get("/getDepartments", getDepartments);
router.delete("/:deptAbbreviation", verifyToken, isAdmin, deleteDepartment);
export default router;
