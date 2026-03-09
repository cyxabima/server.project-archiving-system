import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import ApiResponse from "./utils/ApiResponse.js";
import { HealthData } from "./types/utilsTypes.js";
import userRouter from "./routes/user.router.js";
import { errorHandler } from "./middleware/error.middleware.js";

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

// here i will attached all the routers
app.use("/api/v1/users", userRouter);





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
