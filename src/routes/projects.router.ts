import { Router } from "express";
import { getProjects } from "../controllers/project.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = Router();

// filter is embedded within controller 
router.get("/", verifyToken, getProjects);


export default router;