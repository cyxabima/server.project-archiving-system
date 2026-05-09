import { Router } from "express";
import {createStudent, updateStudent} from "../controllers/student.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router()

router.post("/", verifyToken, isAdmin, createStudent);
router.patch("/:seatno", verifyToken, isAdmin, updateStudent);

export default router