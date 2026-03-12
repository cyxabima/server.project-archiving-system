import { NextFunction, Request, Response } from "express";
import ApiError from "../utils/ApiError.js";
import pool from "../db/index.js";
import ApiResponse from "../utils/ApiResponse.js";

export async function createUser(req: Request, res: Response, next: NextFunction) {

  const { userName, email, password, userType } = req.body;
  // if ([userName, email, password, userType].some((field) => !field)) {
  //   return next(new ApiError(422, "Unpocessable Entity", "All fields are required"));
  // }
  //

  const emailExists = await pool.query(`Select 1 from Users Where email = $1`, [email]);
  if (emailExists.rowCount) {
    return next(new ApiError(409, "Conflict", "Email already exits"));
  }

  const userNameExists = await pool.query(`Select 1 from Users Where user_name = $1`, [userName]);
  if (userNameExists.rowCount) {
    return next(new ApiError(409, "Conflict", "userNamealready exits"));
  }

  // currenlty not hashing the password but  TODO:

  const user = await pool.query(
    `INSERT INTO users (user_name, email, password)
   VALUES ($1, $2, $3)
   RETURNING id, user_name, email`,
    [userName, email, password]
  );
  return res.status(201).json(new ApiResponse(201, user.rows[0], "user created successfully"));
}
