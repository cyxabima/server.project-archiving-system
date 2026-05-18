import { Router } from "express";
import { createGroup, updateGroup, getGroups, deleteGroup } from "../controllers/group.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";
import { ro } from "date-fns/locale";

const router = Router();

router.post("/", verifyToken, isAdmin, createGroup);
router.patch("/:groupId", verifyToken, isAdmin, updateGroup);
router.get("/getGroups", verifyToken, getGroups);
router.delete("/:groupId", verifyToken, isAdmin, deleteGroup)

export default router;
