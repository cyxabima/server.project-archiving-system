import { Router } from "express";
import { createAdmin } from "../controllers/user.controller.js";

const userRouter = Router();
userRouter.post("/", createAdmin);

export default userRouter;
