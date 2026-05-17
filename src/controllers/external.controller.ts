import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

export async function createExternal(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { extEmail, extName, extDesignation, industryName } = req.body;

  if ([extEmail, extName, industryName].some((field) => !field)) {
    return next(
      new ApiError(422, "Unprocessable Entity", "Email, Name, and Industry Name are required")
    );
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

    const query = `
            INSERT INTO external_superv (ext_email, ext_name, ext_designation, industry_id)
            VALUES ($1, $2, $3, $4) 
            RETURNING ext_email AS "extEmail", ext_name AS "extName", ext_designation AS "extDesignation", industry_id AS "industryId";
        `;
    const result = await pool.query(query, [extEmail, extName, extDesignation, industryId]);

    result.rows[0].industryName = industryName;

    return res
      .status(201)
      .json(new ApiResponse(201, result.rows[0], "External supervisor created successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "External supervisor with this email already exists")
      );
    }
    if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(new ApiError(409, "Conflict", "The specified industry ID does not exist"));
    }

    console.error("External Creation Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to create external supervisor"));
  }
}

export async function updateExternal(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }
  const { extEmail } = req.params;
  const { extName, extDesignation, industryName } = req.body;

  try {
    let industryId = undefined;

    if (industryName) {
      const industryQuery = `SELECT industry_id FROM industry WHERE industry_name = $1`;
      const industryResult = await pool.query(industryQuery, [industryName]);

      if (industryResult.rows.length === 0) {
        return next(
          new ApiError(404, "Not Found", `Industry '${industryName}' does not exist in the system.`)
        );
      }
      industryId = industryResult.rows[0].industry_id;
    }

    const query = `
            UPDATE external_superv 
            SET ext_name = COALESCE($1, ext_name), 
                ext_designation = COALESCE($2, ext_designation), 
                industry_id = COALESCE($3, industry_id)
            WHERE ext_email = $4 
            RETURNING ext_email AS "extEmail", ext_name AS "extName", ext_designation AS "extDesignation", industry_id AS "industryId";
        `;
    const result = await pool.query(query, [extName, extDesignation, industryId, extEmail]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "External supervisor not found"));
    }

    if (industryName) {
      result.rows[0].industryName = industryName;
    }

    return res
      .status(200)
      .json(new ApiResponse(200, result.rows[0], "External updated successfully"));
  } catch (err: any) {
    if (err.code === DbErrorCodes.FOREIGN_KEY_VIOLATION)
      return next(new ApiError(409, "Conflict", "Industry ID does not exist"));
    return next(new ApiError(500, "Database Error", "Failed to update external supervisor"));
  }
}

export async function getExternals(req: Request, res: Response, next: NextFunction) {
  try {
    let queryText = `
      SELECT ext_email, ext_name, ext_designation, industry_id
      FROM external_superv
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramCounter = 1;

    // Filter = Industry ID
    if (req.query.industryId) {
      queryText += ` AND industry_id = $${paramCounter}`;
      queryParams.push(req.query.industryId);
      paramCounter++;
    }

    queryText += ` ORDER BY ext_name ASC;`;

    const result = await pool.query(queryText, queryParams);

    return res
      .status(200)
      .json(new ApiResponse(200, result.rows, "External supervisors fetched successfully"));
  } catch (error) {
    console.error("Error fetching external supervisors:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to fetch external supervisors"));
  }
}
