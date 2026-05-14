import { Router } from "express";
import { getAuditLogs } from "../controllers/audit.controller.js"; 
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/getAudits", verifyToken, isAdmin, getAuditLogs);

export default router;
