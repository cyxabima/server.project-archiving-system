import { Router } from "express";
import { createExternal, updateExternal } from "../controllers/external.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router();
router.post("/", verifyToken, isAdmin, createExternal);
router.patch("/:extEmail", verifyToken, isAdmin, updateExternal);

export default router;