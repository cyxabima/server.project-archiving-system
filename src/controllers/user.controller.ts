import { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

const SALT_ROUNDS = 12;

export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  // checking obj keys in case of empty {}
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { userId, userName, userEmail, userContactNo, password, deptAbbreviation, adminLvl } =
    req.body;

  if ([userId, userName, userEmail, password, deptAbbreviation, adminLvl].some((field) => !field)) {
    return next(new ApiError(422, "Unprocessable Entity", "All required fields must be provided"));
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userQuery = `
      INSERT INTO users (user_id, user_name, user_email, user_contact_no, password, dept_abbreviation)
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING user_id AS "userId", user_name AS "userName", user_email AS "userEmail", dept_abbreviation AS "deptAbbreviation"
    `;
    const userRes = await client.query(userQuery, [
      userId,
      userName,
      userEmail,
      userContactNo,
      hashedPassword,
      deptAbbreviation
    ]);

    const adminQuery = `
      INSERT INTO admin (user_id, admin_lvl) 
      VALUES ($1, $2) 
      RETURNING admin_lvl AS "adminLvl"
    `;
    const adminRes = await client.query(adminQuery, [userId, adminLvl]);

    const adminData = { ...userRes.rows[0], ...adminRes.rows[0] };
    await client.query("COMMIT");

    return res.status(201).json(new ApiResponse(201, adminData, "Admin created successfully"));
  } catch (err: unknown) {
    await client.query("ROLLBACK");

    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(new ApiError(409, "Conflict", "User ID or Email already exists"));
    }
    if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "The specified department abbreviation does not exist")
      );
    }

    console.error("Transaction Error", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to create Admin"));
  } finally {
    client.release();
  }
}

export async function addFaculty(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const {
    userId,
    userName,
    userEmail,
    userContactNo,
    password,
    deptAbbreviation,
    designation,
    areaOfResearch
  } = req.body;

  if (
    [userId, userName, userEmail, password, deptAbbreviation, designation].some((field) => !field)
  ) {
    return next(new ApiError(422, "Unprocessable Entity", "All required fields must be provided"));
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userQuery = `
      INSERT INTO users (user_id, user_name, user_email, user_contact_no, password, dept_abbreviation)
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING user_id AS "userId", user_name AS "userName", user_email AS "userEmail"
    `;
    const userRes = await client.query(userQuery, [
      userId,
      userName,
      userEmail,
      userContactNo,
      hashedPassword,
      deptAbbreviation
    ]);

    const facultyQuery = `
      INSERT INTO faculty (user_id, designation, area_of_research) 
      VALUES ($1, $2, $3) 
      RETURNING designation, area_of_research AS "areaOfResearch"
    `;
    const facultyRes = await client.query(facultyQuery, [userId, designation, areaOfResearch]);

    const facultyData = { ...userRes.rows[0], ...facultyRes.rows[0] };
    await client.query("COMMIT");

    return res.status(201).json(new ApiResponse(201, facultyData, "Faculty added successfully"));
  } catch (err: unknown) {
    await client.query("ROLLBACK");

    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(new ApiError(409, "Conflict", "User ID or Email already exists"));
    }
    if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "The specified department abbreviation does not exist")
      );
    }

    console.error("Transaction Error:", error);
    return next(new ApiError(500, "Internal Server Error", "Database transaction failed"));
  } finally {
    client.release();
  }
}

export async function addStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { userId, userName, userEmail, userContactNo, password, deptAbbreviation, jobTitle } =
    req.body;

  if ([userId, userName, userEmail, password, deptAbbreviation, jobTitle].some((field) => !field)) {
    return next(new ApiError(422, "Unprocessable Entity", "All required fields must be provided"));
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userQuery = `
      INSERT INTO users (user_id, user_name, user_email, user_contact_no, password, dept_abbreviation)
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING user_id AS "userId", user_name AS "userName", user_email AS "userEmail"
    `;
    const userRes = await client.query(userQuery, [
      userId,
      userName,
      userEmail,
      userContactNo,
      hashedPassword,
      deptAbbreviation
    ]);

    const staffQuery = `
      INSERT INTO staff (user_id, job_title) 
      VALUES ($1, $2) 
      RETURNING job_title AS "jobTitle"
    `;
    const staffRes = await client.query(staffQuery, [userId, jobTitle]);

    const staffData = { ...userRes.rows[0], ...staffRes.rows[0] };
    await client.query("COMMIT");

    return res.status(201).json(new ApiResponse(201, staffData, "Staff added successfully"));
  } catch (err: unknown) {
    await client.query("ROLLBACK");

    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(new ApiError(409, "Conflict", "User ID or Email already exists"));
    }
    if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "The specified department abbreviation does not exist")
      );
    }

    console.error("Transaction Error:", error);
    return next(new ApiError(500, "Internal Server Error", "Database transaction failed"));
  } finally {
    client.release();
  }
}
