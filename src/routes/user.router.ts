import { Router } from "express";
import { createAdmin, addFaculty, addStaff, getUsers } from "../controllers/user.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/admin", verifyToken, isAdmin, createAdmin);
router.post("/faculty", verifyToken, isAdmin, addFaculty);
router.post("/staff", verifyToken, isAdmin, addStaff);
router.get("/getUsers", verifyToken, isAdmin, getUsers);

export default router;
