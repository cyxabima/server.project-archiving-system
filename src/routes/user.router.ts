import { Router } from "express";
import { createAdmin, addFaculty } from "../controllers/user.controller.js";

const userRouter = Router();
userRouter.post("/createAdmin", createAdmin);
userRouter.post("/addFaculty", addFaculty);
export default userRouter;
