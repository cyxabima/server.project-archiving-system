import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

// POST /api/v1/grants
export async function createGrant(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { projectId, grantName, recievedDate, grantAmount, industryName } = req.body;

  if ([projectId, grantName, recievedDate, industryName].some((field) => field === undefined)) {
    return next(
      new ApiError(
        422,
        "Unprocessable Entity",
        "Project ID, Grant Name, Received Date, and Industry Name are required"
      )
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

    const insertQuery = `
      INSERT INTO grants (project_id, grant_name, recieved_date, grant_amount, industry_id)
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING 
          project_id AS "projectId",
          grant_name AS "grantName", 
          recieved_date AS "recievedDate",
          grant_amount AS "grantAmount", 
          industry_id AS "industryId";
    `;

    const result = await pool.query(insertQuery, [
      projectId,
      grantName,
      recievedDate,
      grantAmount || null,
      industryId
    ]);

    result.rows[0].industryName = industryName;

    return res
      .status(201)
      .json(new ApiResponse(201, result.rows[0], "Grant recorded successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "This grant name already exists for this specific project")
      );
    }
    if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(new ApiError(409, "Conflict", "The specified Project ID does not exist"));
    }

    console.error("Grant Creation Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to create grant"));
  }
}

// PATCH /api/v1/grants/:projectId/:grantName
export async function updateGrant(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { projectId, grantName } = req.params;
  const { recievedDate, grantAmount, industryName } = req.body;

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
      UPDATE grants 
      SET 
          recieved_date = COALESCE($1, recieved_date),
          grant_amount = COALESCE($2, grant_amount), 
          industry_id = COALESCE($3, industry_id)
      WHERE project_id = $4 AND grant_name = $5 
      RETURNING 
          project_id AS "projectId",
          grant_name AS "grantName", 
          recieved_date AS "recievedDate",
          grant_amount AS "grantAmount", 
          industry_id AS "industryId";
    `;

    const result = await pool.query(query, [
      recievedDate,
      grantAmount,
      industryId,
      projectId,
      grantName
    ]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "Grant not found for this project"));
    }

    if (industryName) {
      result.rows[0].industryName = industryName;
    }

    return res.status(200).json(new ApiResponse(200, result.rows[0], "Grant updated successfully"));
  } catch (err: any) {
    if (err.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(new ApiError(409, "Conflict", "Industry ID or Project ID does not exist"));
    }
    return next(new ApiError(500, "Database Error", "Failed to update grant"));
  }
}

// GET /api/v1/grants
export async function getGrants(req: Request, res: Response, next: NextFunction) {
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
      conditionQuery += ` AND (g.grant_name ILIKE $${paramCounter} OR i.industry_name ILIKE $${paramCounter})`;
      queryParams.push(searchTerm);
      paramCounter++;
    }

    // Filter = Project ID
    if (req.query.projectId) {
      conditionQuery += ` AND g.project_id = $${paramCounter}`;
      queryParams.push(req.query.projectId);
      paramCounter++;
    }

    // Filter = Industry ID
    if (req.query.industryId) {
      conditionQuery += ` AND g.industry_id = $${paramCounter}`;
      queryParams.push(req.query.industryId);
      paramCounter++;
    }

    const dataQuery = `
      SELECT 
          g.project_id AS "projectId",
          g.grant_name AS "grantName", 
          g.recieved_date AS "recievedDate",
          g.grant_amount AS "grantAmount", 
          i.industry_name AS "industryName"
      FROM grants g
      LEFT JOIN industry i ON g.industry_id = i.industry_id
      ${conditionQuery}
      ORDER BY g.recieved_date DESC, g.grant_name ASC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1};
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM grants g
      LEFT JOIN industry i ON g.industry_id = i.industry_id
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
      .json(new ApiResponse(200, responsePayload, "Grants fetched successfully"));
  } catch (error) {
    console.error("Error fetching grants:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to fetch grants"));
  }
}