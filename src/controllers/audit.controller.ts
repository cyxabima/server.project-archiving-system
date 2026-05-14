import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

import { Request, Response, NextFunction } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";

// GET /api/v1/audit-logs
export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  let limit = 20; // DefaultCase
  let offset = 0;

  if (req.query.limit && req.query.offset) {
    limit = parseInt(req.query.limit as string, 10);
    offset = parseInt(req.query.offset as string, 10);
    if (isNaN(limit)) limit = 20;
    if (isNaN(offset)) offset = 0;
  }

  try {
    let conditionQuery = `WHERE 1=1`;
    const queryParams: any[] = [];
    let paramCounter = 1;

    // Specific Table
    if (req.query.tableName) {
      conditionQuery += ` AND table_name = $${paramCounter}`;
      queryParams.push(req.query.tableName);
      paramCounter++;
    }

    // Specific Action
    if (req.query.action) {
      conditionQuery += ` AND action = $${paramCounter}`;
      queryParams.push(req.query.action);
      paramCounter++;
    }

    // Date Range Start
    if (req.query.startDate) {
      conditionQuery += ` AND changed_at >= $${paramCounter}`;
      queryParams.push(req.query.startDate);
      paramCounter++;
    }

    // Date Range End
    if (req.query.endDate) {
      // We append '23:59:59' to ensure it captures the whole end day
      conditionQuery += ` AND changed_at <= $${paramCounter}::timestamp + interval '23 hours 59 minutes 59 seconds'`;
      queryParams.push(req.query.endDate);
      paramCounter++;
    }

    const dataQuery = `
            SELECT log_id, table_name, action, old_data, new_data, changed_at
            FROM audit_logs
            ${conditionQuery}
            ORDER BY changed_at DESC
            LIMIT $${paramCounter} OFFSET $${paramCounter + 1};
        `;

    const countQuery = `
            SELECT COUNT(*)
            FROM audit_logs
            ${conditionQuery};
        `;

    const dataParams = [...queryParams, limit, offset];

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, dataParams),
      pool.query(countQuery, queryParams)
    ]);

    // Meta Data
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
      .json(new ApiResponse(200, responsePayload, "Audit logs retrieved successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;
    console.error("Audit Logs Retrieval Error:", error);

    return next(new ApiError(500, "Database Error", "Failed to retrieve audit logs"));
  }
}
