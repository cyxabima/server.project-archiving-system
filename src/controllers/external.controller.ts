import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

export async function createExternal(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { extEmail, extName, extDesignation, industryId } = req.body;

  if ([extEmail, extName, industryId].some((field) => !field)) {
    return next(
      new ApiError(422, "Unprocessable Entity", "Email, Name, and Industry ID are required")
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const query = `
            INSERT INTO external_superv (ext_email, ext_name, ext_designation, industry_id)
            VALUES ($1, $2, $3, $4) 
            RETURNING ext_email AS "extEmail", ext_name AS "extName";
        `;
    const result = await client.query(query, [extEmail, extName, extDesignation, industryId]);

    await client.query("COMMIT");
    return res
      .status(201)
      .json(new ApiResponse(201, result.rows[0], "External supervisor created successfully"));
  } catch (err: unknown) {
    await client.query("ROLLBACK");
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
  } finally {
    client.release();
  }
}

export async function updateExternal(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }
  const { extEmail } = req.params; // Email is the Primary Key
  const { extName, extDesignation, industryId } = req.body;
  const client = await pool.connect();

  try {
    const query = `
            UPDATE external_superv 
            SET ext_name = COALESCE($1, ext_name), ext_designation = COALESCE($2, ext_designation), 
                industry_id = COALESCE($3, industry_id)
            WHERE ext_email = $4 RETURNING *;
        `;
    const result = await client.query(query, [extName, extDesignation, industryId, extEmail]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "External supervisor not found"));
    }
    return res
      .status(200)
      .json(new ApiResponse(200, result.rows[0], "External updated successfully"));
  } catch (err: any) {
    if (err.code === DbErrorCodes.FOREIGN_KEY_VIOLATION)
      return next(new ApiError(409, "Conflict", "Industry ID does not exist"));
    return next(new ApiError(500, "Database Error", "Failed to update external supervisor"));
  } finally {
    client.release();
  }
}
