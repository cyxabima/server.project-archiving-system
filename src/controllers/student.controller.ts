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

  const { seatNo, stdName, stdEmail, batch, deptAbbr } = req.body;

  if (!seatNo || !stdName || !stdEmail || !batch || !deptAbbr) {
    return next(
      new ApiError(
        422,
        "Unprocessable Entity",
        "Seat No, Name, Email, Batch, and Department are required"
      )
    );
  }

  try {
    const query = `
      INSERT INTO students (seat_no, std_name, std_email, batch, dept_abbreviation)
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING 
          seat_no AS "seatNo", 
          std_name AS "stdName", 
          std_email AS "stdEmail",
          batch AS "batch",
          dept_abbreviation AS "deptAbbreviation";
    `;
    const result = await pool.query(query, [seatNo, stdName, stdEmail, batch, deptAbbr]);

    return res.status(201).json(new ApiResponse(201, result.rows[0], "Student added successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "A student with this Seat Number or Email already exists")
      );
    }
    if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "The specified Department Abbreviation does not exist")
      );
    }

    console.error("Student Creation Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to add student"));
  }
}

// PATCH /api/v1/students/:seatNo
export async function updateStudent(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { seatNo } = req.params;
  const { stdName, stdEmail, batch, deptAbbr } = req.body;

  try {
    const query = `
      UPDATE students 
      SET 
          std_name = COALESCE($1, std_name), 
          std_email = COALESCE($2, std_email), 
          batch = COALESCE($3, batch),
          dept_abbreviation = COALESCE($4, dept_abbreviation)
      WHERE seat_no = $5 
      RETURNING 
          seat_no AS "seatNo", 
          std_name AS "stdName",
          std_email AS "stdEmail",
          batch AS "batch",
          dept_abbreviation AS "deptAbbreviation";
    `;
    const result = await pool.query(query, [stdName, stdEmail, batch, deptAbbr, seatNo]);

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
      return next(
        new ApiError(409, "Conflict", "The specified Department Abbreviation does not exist")
      );
    }

    console.error("Student Update Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to update student"));
  }
}

// GET /api/v1/students
export async function getStudents(req: Request, res: Response, next: NextFunction) {
  let limit = 50;
  let offset = 0;

  if (req.query.limit && req.query.offset) {
    limit = parseInt(req.query.limit as string, 10);
    offset = parseInt(req.query.offset as string, 10);
    if (isNaN(limit)) limit = 10;
    if (isNaN(offset)) offset = 0;
  }

  try {
    let conditionQuery = `WHERE 1=1`;
    const queryParams: any[] = [];
    let paramCounter = 1;

    // Filter = Batch Year
    if (req.query.batch) {
      conditionQuery += ` AND batch = $${paramCounter}`;
      queryParams.push(req.query.batch);
      paramCounter++;
    }

    // Filter = Department Abbreviation
    if (req.query.deptAbbreviation) {
      conditionQuery += ` AND dept_abbreviation = $${paramCounter}`;
      queryParams.push(req.query.deptAbbreviation);
      paramCounter++;
    }

    const dataQuery = `
      SELECT 
          seat_no AS "seatNo", 
          std_name AS "stdName", 
          std_email AS "stdEmail", 
          batch AS "batch",
          dept_abbreviation AS "deptAbbreviation"
      FROM students
      ${conditionQuery}
      ORDER BY seat_no ASC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1};
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM students
      ${conditionQuery};
    `;

    const dataParams = [...queryParams, limit, offset];

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, dataParams),
      pool.query(countQuery, queryParams)
    ]);

    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    const responsePayload = {
      data: dataResult.rows,
      meta: {
        currentPage,
        totalPages,
        totalRecords
      }
    };

    return res
      .status(200)
      .json(new ApiResponse(200, responsePayload, "Students fetched successfully"));
  } catch (error) {
    console.error("Error fetching students:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to fetch students"));
  }
}
export async function deleteStudent(req: Request, res: Response, next: NextFunction) {
  const { seatNo } = req.params;

  try {
    const query = `
      DELETE FROM students 
      WHERE seat_no = $1 
      RETURNING seat_no AS "seatNo";
    `;

    const result = await pool.query(query, [seatNo]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "Student not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Student deleted successfully"));

  } catch (err: any) {
    if (err.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(
        new ApiError(
          409,
          "Conflict",
          "Cannot delete student because they are currently assigned to a group or project."
        )
      );
    }

    console.error("Delete Student Error:", err);
    return next(new ApiError(500, "Database Error", "Failed to delete student"));
  }
}
