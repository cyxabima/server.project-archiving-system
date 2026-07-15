import { Router } from "express";
import { createStudent, updateStudent, getStudents, deleteStudent } from "../controllers/student.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";
const router = Router();
router.post("/", verifyToken, isAdmin, createStudent);
router.patch("/:seatNo", verifyToken, isAdmin, updateStudent);
router.get("/getStudents", verifyToken, getStudents);
router.delete("/:seatNo", verifyToken, isAdmin, deleteStudent);
export default router;
