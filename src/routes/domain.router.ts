import { Router } from "express";
import { getAllDomains, getDomainsByDept } from "../controllers/domain.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", verifyToken, getAllDomains);
router.get("/department/:deptAbbreviation", verifyToken, getDomainsByDept);

export default router;
