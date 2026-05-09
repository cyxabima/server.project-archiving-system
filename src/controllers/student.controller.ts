import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

// POST /api/v1/students
export async function createStudent(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { seatNo, stdName, stdEmail, batch } = req.body;

  if (!seatNo || !stdName || !stdEmail || !batch) {
    return next(
      new ApiError(422, "Unprocessable Entity", "Seat No, Name, Email, and Batch are required")
    );
  }

  const client = await pool.connect();

  try {
    const query = `
            INSERT INTO students (seat_no, std_name, std_email, batch, project_id)
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING seat_no AS "seatNo", std_name AS "stdName", std_email AS "stdEmail";
        `;
    const result = await client.query(query, [seatNo, stdName, stdEmail, batch]);

    return res.status(201).json(new ApiResponse(201, result.rows[0], "Student added successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "A student with this Seat Number or Email already exists")
      );
    }
    if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(new ApiError(409, "Conflict", "The specified Project ID does not exist"));
    }

    console.error("Student Creation Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to add student"));
  } finally {
    client.release();
  }
}

// PATCH /api/v1/students/:seatNo
export async function updateStudent(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { seatNo } = req.params;
  const { stdName, stdEmail, batch } = req.body;

  const client = await pool.connect();

  try {
    const query = `
            UPDATE students 
            SET std_name = COALESCE($1, std_name), 
                std_email = COALESCE($2, std_email), 
                batch = COALESCE($3, batch)
            WHERE seat_no = $5 
            RETURNING seat_no AS "seatNo", std_name AS "stdName";
        `;
    const result = await client.query(query, [stdName, stdEmail, batch, seatNo]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "Student not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, result.rows[0], "Student updated successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(new ApiError(409, "Conflict", "This email is already in use by another student"));
    }
    if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(new ApiError(409, "Conflict", "The specified Project ID does not exist"));
    }

    console.error("Student Update Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to update student"));
  } finally {
    client.release();
  }
}
