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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const query = `
            INSERT INTO industry (industry_name, location, industry_type, industry_email)
            VALUES ($1, $2, $3, $4) 
            RETURNING industry_id AS "industryId", industry_name AS "industryName";
        `;
    const result = await client.query(query, [industryName, location, industryType, industryEmail]);

    await client.query("COMMIT");
    return res
      .status(201)
      .json(new ApiResponse(201, result.rows[0], "Industry created successfully"));
  } catch (err: unknown) {
    await client.query("ROLLBACK");
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(new ApiError(409, "Conflict", "Industry name or email already exists"));
    }

    console.error("Industry Creation Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to create industry"));
  } finally {
    client.release();
  }
}

export async function updateIndustry(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }
  const { industryId } = req.params;
  const { industryName, location, industryType, industryEmail } = req.body;
  const client = await pool.connect();

  try {
    const query = `
            UPDATE industry 
            SET industry_name = COALESCE($1, industry_name), location = COALESCE($2, location), 
                industry_type = COALESCE($3, industry_type), industry_email = COALESCE($4, industry_email)
            WHERE industry_id = $5 RETURNING *;
        `;
    const result = await client.query(query, [
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
  } finally {
    client.release();
  }
}
