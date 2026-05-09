import { Router } from "express";
import {createDomain,updateDomain, getAllDomains, getDomainsByDept } from "../controllers/domain.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", verifyToken, isAdmin, createDomain);
router.patch("/:domainId", verifyToken, isAdmin, updateDomain);
router.get("/", verifyToken, getAllDomains);
router.get("/department/:deptAbbreviation", verifyToken, getDomainsByDept);

export default router;
