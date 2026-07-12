import { Router } from "express";
import { getProjects, listProjects, createProject, updateProject, getProjectById, archiveProject, restoreProject } from "../controllers/project.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import multer from "multer";

const router = Router();
//Config for in-RAM Memory
const upload = multer({ storage: multer.memoryStorage() });

// filter is embedded within controller getProjects
router.get("/getProjects", getProjects);
router.get("/pageProjects", verifyToken, listProjects);
router.get("/:projectId", getProjectById);
router.patch("/:projectId", verifyToken,
  upload.fields([{ name: "reportFile", maxCount: 1 }, { name: "resourceFile", maxCount: 1 }]),
  updateProject
);
router.patch("/:projectId/archive", verifyToken, archiveProject);
router.patch("/:projectId/restore", verifyToken, restoreProject);
router.post(
  "/create",
  upload.fields([
    { name: "reportFile", maxCount: 1 },
    { name: "resourceFile", maxCount: 1 }
  ]),
  createProject
);

export default router;
