import { NextFunction, Request, Response } from "express";
import ApiError from "../utils/ApiError.js";
import pool from "../db/index.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

export async function addDepartment(req: Request, res: Response, next: NextFunction) {
  // checking obj keys in case of empty {}
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { deptAbbreviation, deptName } = req.body;

  if ([deptAbbreviation, deptName].some((field) => !field)) {
    return next(new ApiError(422, "Unprocessable Entity", "All fields are required"));
  }

  try {
    const deptQuery = `
            INSERT INTO department (dept_abbreviation, dept_name)
            VALUES ($1, $2) 
            RETURNING 
                dept_abbreviation AS "deptAbbreviation", 
                dept_name AS "deptName";
        `;

    const deptRes = await pool.query(deptQuery, [deptAbbreviation, deptName]);

    return res
      .status(201)
      .json(new ApiResponse(201, deptRes.rows[0], "Department Added Successfully."));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(new ApiError(409, "Conflict", "Department name or abbreviation already exists"));
    }

    console.error("Transaction Error", error);
    return next(new ApiError(500, "DATABASE FAILED", "Failed to execute Query"));
  }
}

export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  // a patch req like: /departments/:abbreviation: would hit the server

  const oldAbbr = req.params.abbreviation;
  const { deptAbbreviation, deptName } = req.body;

  if (!deptAbbreviation && !deptName) {
    return next(
      new ApiError(400, "Bad Request", "Please provide a name or abbreviation to change.")
    );
  }

  try {
    const updateQuery = `
            UPDATE department 
            SET 
                dept_abbreviation = COALESCE($1, dept_abbreviation),
                dept_name = COALESCE($2, dept_name)
            WHERE dept_abbreviation = $3
            RETURNING 
                dept_abbreviation AS "deptAbbreviation", 
                dept_name AS "deptName";
        `;

    const result = await pool.query(updateQuery, [deptAbbreviation, deptName, oldAbbr]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "Department not found."));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, result.rows[0], "Department updated successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "A Department with this Abbreviation already exists")
      );
    }

    console.error("Transaction Error", error);
    return next(new ApiError(500, "DATABASE FAILED", "Failed to execute Query"));
  }
}

// GET /api/v1/departments
export async function getDepartments(req: Request, res: Response, next: NextFunction) {
  // Default pagination values
  let limit = 20;
  let offset = 0;

  if (req.query.limit) {
    limit = parseInt(req.query.limit as string, 10);
    if (isNaN(limit)) limit = 20;
  }

  if (req.query.offset) {
    offset = parseInt(req.query.offset as string, 10);
    if (isNaN(offset)) offset = 0;
  }

  try {
    let conditionQuery = `WHERE 1=1`;
    const queryParams: any[] = [];
    let paramCounter = 1;

    // Search Parameter (case-insensitive partial match)
    if (req.query.search) {
      const searchTerm = `%${req.query.search}%`;
      conditionQuery += ` AND (dept_name ILIKE $${paramCounter} OR dept_abbreviation ILIKE $${paramCounter})`;
      queryParams.push(searchTerm);
      paramCounter++;
    }

    // Filter = Exact Department Abbreviation
    if (req.query.deptAbbreviation) {
      conditionQuery += ` AND dept_abbreviation = $${paramCounter}`;
      queryParams.push(req.query.deptAbbreviation);
      paramCounter++;
    }

    const dataQuery = `
      SELECT dept_abbreviation, dept_name
      FROM department
      ${conditionQuery}
      ORDER BY dept_abbreviation ASC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1};
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM department
      ${conditionQuery};
    `;

    const dataParams = [...queryParams, limit, offset];

    // Execute both queries concurrently
    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, dataParams),
      pool.query(countQuery, queryParams)
    ]);

    // Calculate pagination metadata
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
      .json(new ApiResponse(200, responsePayload, "Departments fetched successfully"));
  } catch (error) {
    console.error("Error fetching departments:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to fetch departments"));
  }
}

export async function deleteDepartment(req: Request, res: Response, next: NextFunction) {
  const { deptAbbreviation } = req.params;

  try {
    const query = `
      DELETE FROM department 
      WHERE dept_abbreviation = $1 
      RETURNING dept_abbreviation AS "deptAbbreviation";
    `;

    const result = await pool.query(query, [deptAbbreviation]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "Department not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Department deleted successfully"));

  } catch (err: any) {
    if (err.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(
        new ApiError(
          409,
          "Conflict",
          "Cannot delete department because it is currently linked to faculty, students, or other active records."
        )
      );
    }

    console.error("Delete Department Error:", err);
    return next(new ApiError(500, "Database Error", "Failed to delete department"));
  }
}
