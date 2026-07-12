import { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

export async function login(req: Request, res: Response, next: NextFunction) {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ApiError(422, "Unprocessable Entity", "Email and password are required"));
  }

  const client = await pool.connect();

  try {
    const query = `
      SELECT
        u.user_id, u.user_name, u.password, u.is_active, u.dept_abbreviation,
        a.admin_lvl,
        CASE
          WHEN a.user_id IS NOT NULL THEN 'admin'
          WHEN f.user_id IS NOT NULL THEN 'faculty'
          WHEN s.user_id IS NOT NULL THEN 'staff'
          ELSE 'unassigned'
        END as role
      FROM users u
      LEFT JOIN admin a ON u.user_id = a.user_id
      LEFT JOIN faculty f ON u.user_id = f.user_id
      LEFT JOIN staff s ON u.user_id = s.user_id
      WHERE u.user_email = $1;
    `;

    const result = await client.query(query, [email]);

    if (result.rowCount === 0) {
      return next(new ApiError(401, "Unauthorized", "Invalid email or password"));
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return next(new ApiError(403, "Forbidden", "This account has been deactivated"));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(new ApiError(401, "Unauthorized", "Invalid email or password"));
    }

    const tokenPayload = {
      userId: user.user_id,
      role: user.role,
      dept: user.dept_abbreviation,
      adminLevel: user.admin_lvl || null // if not available then assigning null
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET as string, { expiresIn: "30d" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    delete user.password;

    return res.status(200).json(new ApiResponse(200, { user }, "Login successful"));
  } catch (error) {
    console.error("Login Error:", error);
    return next(new ApiError(500, "Internal Server Error", "Login failed"));
  } finally {
    client.release();
  }
}
