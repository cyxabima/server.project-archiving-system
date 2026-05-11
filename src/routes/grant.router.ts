import { Router } from "express";
import { createGrant, updateGrant, getGrants } from "../controllers/grant.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router();
router.post("/", verifyToken, isAdmin, createGrant);
router.patch("/:projectId/:grantName", verifyToken, isAdmin, updateGrant);
router.get("/getGrants", verifyToken, getGrants)

export default router;
