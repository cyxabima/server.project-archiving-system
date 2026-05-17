import { Router } from "express";
import {
  createAdmin,
  addFaculty,
  addStaff,
  getUsers,
  getSupervisingFaculty,
  updateUser,
  getUserById,
  softDeleteUser
} from "../controllers/user.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/admin", verifyToken, isAdmin, createAdmin);
router.post("/faculty", verifyToken, isAdmin, addFaculty);
router.post("/staff", verifyToken, isAdmin, addStaff);
router.get("/getUsers", verifyToken, isAdmin, getUsers);
router.get("/getSupervisingFaculty", verifyToken, isAdmin, getSupervisingFaculty);
router.get("/:id", verifyToken, isAdmin, getUserById);
router.patch("/:id", verifyToken, isAdmin, updateUser);
router.delete("/:id", verifyToken, isAdmin, softDeleteUser);

export default router;
