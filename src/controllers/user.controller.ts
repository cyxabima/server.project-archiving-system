import { NextFunction, Request, Response } from "express";
import ApiError from "../utils/ApiError.js";
import pool from "../db/index.js";
import ApiResponse from "../utils/ApiResponse.js";

export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  const { userName, email, password, departmentId, adminLevel } = req.body;

  if ([userName, email, password].some((field) => !field)) {
    return next(new ApiError(422, "Unpocessable Entity", "All fields are required"));
  }

  const client = await pool.connect();
  try {
    const emailExists = await client.query(`Select 1 from Users Where email = $1`, [email]);
    if (emailExists.rowCount) {
      return next(new ApiError(409, "Conflict", "Email already exits"));
    }

    const userNameExists = await client.query(`Select 1 from Users Where user_name = $1`, [
      userName
    ]);
    if (userNameExists.rowCount) {
      return next(new ApiError(409, "Conflict", "userNamealready exits"));
    }

    // currenlty not hashing the password but  TODO:
    await client.query("BEGIN");

    const userQuery = `
            INSERT INTO users (user_name, email, password, user_type)
            VALUES ($1, $2, $3, 'admin') RETURNING id, user_name, email, user_type`;
    const userRes = await client.query(userQuery, [userName, email, password]);
    const newUserId = userRes.rows[0].id;

    const adminQuery = `
            INSERT INTO admins (id, department_id, admin_level) 
            VALUES ($1, $2, $3) RETURNING department_id, admin_level`;
    const adminRes = await client.query(adminQuery, [newUserId, departmentId, adminLevel]);

    const adminData = { ...userRes.rows[0], ...adminRes.rows[0] };
    client.query("COMMIT");

    return res.status(201).json(new ApiResponse(201, adminData, "Admin created successfully"));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Transaction Error", error);
    return next(new ApiError(500, "DATABASE FAILED", "faild to run query"));
  } finally {
    client.release();
  }
}

export async function addFaculty(req: Request, res: Response, next: NextFunction) {
  const { userName, email, password, employeeId, designation, departmentId } = req.body;
  if ([userName, email, password].some((field) => !field)) {
    return next(new ApiError(422, "Unpocessable Entity", "All fields are required"));
  }

  const client = await pool.connect();

  try {
    const emailExists = await client.query(`Select 1 from Users Where email = $1`, [email]);
    if (emailExists.rowCount) {
      return next(new ApiError(409, "Conflict", "Email already exits"));
    }

    const userNameExists = await client.query(`Select 1 from Users Where user_name = $1`, [
      userName
    ]);
    if (userNameExists.rowCount) {
      return next(new ApiError(409, "Conflict", "userNamealready exits"));
    }

    // TODO: Hashed the password here or built a utils and call it here;

    await client.query("BEGIN");

    const userQuery = `
            INSERT INTO users (user_name, email, password, user_type)
            VALUES ($1, $2, $3, 'faculty') RETURNING id, user_name,email,user_type`;

    const userRes = await client.query(userQuery, [userName, email, password]);
    const newUserId = userRes.rows[0].id;

    const facultyQuery = `
            INSERT INTO faculty (id, employee_id, designation, department_id)
            VALUES ($1, $2, $3, $4) RETURNING *`;

    const facultyRes = await client.query(facultyQuery, [
      newUserId,
      employeeId,
      designation,
      departmentId
    ]);
    const facultyData = { ...userRes.rows[0], ...facultyRes.rows[0] };
    await client.query("COMMIT");

    return res.status(201).json(new ApiResponse(201, facultyData, "Faculty created successfully"));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Transaction Error:", error);
    return next(new ApiError(500, "Internal Server Error", "Database transaction failed"));
  } finally {
    client.release();
  }
}
