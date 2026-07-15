import { Router } from "express";
import { createExternal, updateExternal, getExternals, deleteExternal } from "../controllers/external.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";
const router = Router();
router.post("/", verifyToken, isAdmin, createExternal);
router.patch("/:extEmail", verifyToken, isAdmin, updateExternal);
router.get("/getExternals", verifyToken, getExternals);
router.delete("/:extEmail", verifyToken, isAdmin, deleteExternal);
export default router;
