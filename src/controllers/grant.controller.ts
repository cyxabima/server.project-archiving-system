import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

export async function createGrant(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { grantName, grantAmount, industryName } = req.body;

  if ([grantName, grantAmount, industryName].some((field) => field === undefined)) {
    return next(new ApiError(422, "Unprocessable Entity", "All grant fields are required"));
  }

  try {
    const industryQuery = `SELECT industry_id FROM industry WHERE industry_name = $1`;
    const industryResult = await pool.query(industryQuery, [industryName]);

    if (industryResult.rows.length === 0) {
      return next(
        new ApiError(404, "Not Found", `Industry '${industryName}' does not exist in the system.`)
      );
    }

    const industryId = industryResult.rows[0].industry_id;

    const insertQuery = `
      INSERT INTO grants (grant_name, grant_amount, industry_id)
      VALUES ($1, $2, $3) 
      RETURNING 
          grant_name AS "grantName", 
          grant_amount AS "grantAmount", 
          industry_id AS "industryId";
    `;

    const result = await pool.query(insertQuery, [grantName, grantAmount, industryId]);

    result.rows[0].industryName = industryName;

    return res
      .status(201)
      .json(new ApiResponse(201, result.rows[0], "Grant recorded successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "A grant with this name already exists in the system")
      );
    }

    console.error("Grant Creation Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to create grant"));
  }
}

export async function updateGrant(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { grantName } = req.params;
  const { grantAmount, industryId } = req.body;

  try {
    const query = `
      UPDATE grants 
      SET 
          grant_amount = COALESCE($1, grant_amount), 
          industry_id = COALESCE($2, industry_id)
      WHERE grant_name = $3 
      RETURNING 
          grant_name AS "grantName", 
          grant_amount AS "grantAmount", 
          industry_id AS "industryId";
    `;

    const result = await pool.query(query, [grantAmount, industryId, grantName]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "Grant not found"));
    }

    return res.status(200).json(new ApiResponse(200, result.rows[0], "Grant updated successfully"));
  } catch (err: any) {
    if (err.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(new ApiError(409, "Conflict", "Industry ID does not exist"));
    }
    return next(new ApiError(500, "Database Error", "Failed to update grant"));
  }
}
export async function getGrants(req: Request, res: Response, next: NextFunction) {
  try {
    let queryText = `
      SELECT 
          g.grant_name AS "grantName", 
          g.grant_amount AS "grantAmount", 
          i.industry_name AS "industryName"
      FROM grants g
      LEFT JOIN industry i ON g.industry_id = i.industry_id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramCounter = 1;

    // Filter = Industry ID
    if (req.query.industryId) {
      queryText += ` AND g.industry_id = $${paramCounter}`;
      queryParams.push(req.query.industryId);
      paramCounter++;
    }

    queryText += ` ORDER BY g.grant_name ASC;`;

    const result = await pool.query(queryText, queryParams);

    return res.status(200).json(new ApiResponse(200, result.rows, "Grants fetched successfully"));
  } catch (error) {
    console.error("Error fetching grants:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to fetch grants"));
  }
}
