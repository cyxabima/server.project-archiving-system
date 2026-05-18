import { Router } from "express";
import { getComprehensiveReport } from "../controllers/report.controller.js";

const router = Router();

router.get("/comprehensive", getComprehensiveReport);

export default router;
