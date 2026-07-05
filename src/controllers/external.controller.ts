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

// GET /api/v1/externals
export async function getExternals(req: Request, res: Response, next: NextFunction) {
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
      conditionQuery += ` AND (e.ext_name ILIKE $${paramCounter} OR e.ext_email ILIKE $${paramCounter} OR e.ext_designation ILIKE $${paramCounter})`;
      queryParams.push(searchTerm);
      paramCounter++;
    }

    // Filter = Industry ID
    if (req.query.industryId) {
      conditionQuery += ` AND e.industry_id = $${paramCounter}`;
      queryParams.push(req.query.industryId);
      paramCounter++;
    }

    const dataQuery = `
      SELECT 
        e.ext_email AS "extEmail", 
        e.ext_name AS "extName", 
        e.ext_designation AS "extDesignation", 
        e.industry_id AS "industryId",
        i.industry_name AS "industryName"
      FROM external_superv e
      LEFT JOIN industry i ON e.industry_id = i.industry_id
      ${conditionQuery}
      ORDER BY e.ext_name ASC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1};
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM external_superv e
      LEFT JOIN industry i ON e.industry_id = i.industry_id
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
      .json(new ApiResponse(200, responsePayload, "External supervisors fetched successfully"));
  } catch (error) {
    console.error("Error fetching external supervisors:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to fetch external supervisors"));
  }
}

export async function deleteExternal(req: Request, res: Response, next: NextFunction) {
  const { extEmail } = req.params;

  try {
    const query = `
      DELETE FROM external_superv 
      WHERE ext_email = $1 
      RETURNING ext_email AS "extEmail";
    `;

    const result = await pool.query(query, [extEmail]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "External supervisor not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "External supervisor deleted successfully"));

  } catch (err: any) {
    if (err.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(
        new ApiError(
          409,
          "Conflict",
          "Cannot delete external supervisor because they are currently assigned to active projects or evaluations."
        )
      );
    }

    console.error("Delete External Supervisor Error:", err);
    return next(new ApiError(500, "Database Error", "Failed to delete external supervisor"));
  }
}
