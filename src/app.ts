import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import ApiResponse from "./utils/ApiResponse.js";
import { HealthData } from "./types/utilsTypes.js";
import userRouter from "./routes/user.router.js";
import authRouter from "./routes/auth.router.js";
import departmentRouter from "./routes/department.router.js";
import { errorHandler } from "./middleware/error.middleware.js";
import domainRouter from "./routes/domain.router.js";
import projectRouter from "./routes/project.router.js";

const corsOptions = {
  origin: ["http://localhost:3000", "*"],
  methods: ["Get", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true // for cookies
};

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(cors(corsOptions));

// routers
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/departments", departmentRouter);
app.use("/api/v1/domains", domainRouter);
app.use("/api/v1/projects", projectRouter);

// health endpoint
app.get("/healthz", (_: Request, res: Response) => {
  const healthData: HealthData = {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };

  return res.status(200).json(new ApiResponse<HealthData>(200, healthData, "Server is healthy"));
});

// custom Middleware
app.use(errorHandler);

export default app;
