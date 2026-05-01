import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    dept: string;
    adminLevel: number | null;
  };
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "Unauthorized", "Access denied. No token provided."));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded as any;
    next();
  } catch (error) {
    return next(new ApiError(403, "Forbidden", "Invalid or expired token."));
  }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new ApiError(401, "Unauthorized", "Authentication required"));
  }

  if (req.user.role !== 'admin') {
    return next(new ApiError(403, "Forbidden", "Access denied. Admin privileges required."));
  }

  next();
};