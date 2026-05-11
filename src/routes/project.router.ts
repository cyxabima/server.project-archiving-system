import { Router } from "express";
import { getProjects, listProjects, searchProject } from "../controllers/project.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = Router();

// filter is embedded within controller getProjects
router.get("/getProjects", verifyToken, getProjects);
router.get("/pageProjects", verifyToken, listProjects);
router.get("/searchProjects", verifyToken, searchProject);

export default router;
