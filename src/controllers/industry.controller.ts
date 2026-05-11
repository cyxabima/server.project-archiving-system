import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

export async function createIndustry(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { industryName, location, industryType, industryEmail } = req.body;

  if (!industryName) {
    return next(new ApiError(422, "Unprocessable Entity", "Industry Name is required"));
  }

  try {
    const query = `
            INSERT INTO industry (industry_name, location, industry_type, industry_email)
            VALUES ($1, $2, $3, $4) 
            RETURNING industry_id AS "industryId", industry_name AS "industryName";
        `;
    const result = await pool.query(query, [industryName, location, industryType, industryEmail]);

    return res
      .status(201)
      .json(new ApiResponse(201, result.rows[0], "Industry created successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(new ApiError(409, "Conflict", "Industry name or email already exists"));
    }

    console.error("Industry Creation Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to create industry"));
  }
}

export async function updateIndustry(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }
  const { industryId } = req.params;
  const { industryName, location, industryType, industryEmail } = req.body;

  try {
    const query = `
            UPDATE industry 
            SET industry_name = COALESCE($1, industry_name), location = COALESCE($2, location), 
                industry_type = COALESCE($3, industry_type), industry_email = COALESCE($4, industry_email)
            WHERE industry_id = $5 RETURNING *;
        `;
    const result = await pool.query(query, [
      industryName,
      location,
      industryType,
      industryEmail,
      industryId
    ]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "Industry not found"));
    }
    return res
      .status(200)
      .json(new ApiResponse(200, result.rows[0], "Industry updated successfully"));
  } catch (err: any) {
    if (err.code === DbErrorCodes.UNIQUE_VIOLATION)
      return next(new ApiError(409, "Conflict", "Industry name or email already exists"));
    return next(new ApiError(500, "Database Error", "Failed to update industry"));
  }
}

export async function getIndustries(req: Request, res: Response, next: NextFunction) {
  try {
    let queryText = `
      SELECT industry_id, industry_name, location, industry_type, industry_email
      FROM industry
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramCounter = 1;

    // Filter = Industry Type
    if (req.query.industryType) {
      queryText += ` AND industry_type = $${paramCounter}`;
      queryParams.push(req.query.industryType);
      paramCounter++;
    }

    queryText += ` ORDER BY industry_name ASC;`;

    const result = await pool.query(queryText, queryParams);

    return res
      .status(200)
      .json(new ApiResponse(200, result.rows, "Industries fetched successfully"));
  } catch (error) {
    console.error("Error fetching industries:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to fetch industries"));
  }
}
