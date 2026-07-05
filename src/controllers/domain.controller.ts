import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

export async function createDomain(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { domainName, domainDescription, deptAbbreviation } = req.body;

  if (!domainName || !deptAbbreviation) {
    return next(
      new ApiError(
        422,
        "Unprocessable Entity",
        "Domain Name and Department Abbreviation are required"
      )
    );
  }

  try {
    const query = `
            INSERT INTO domains (domain_name, domain_description, dept_abbreviation)
            VALUES ($1, $2, $3) 
            RETURNING domain_id AS "domainId", domain_name AS "domainName", domain_description AS domainDescription, dept_abbreviation AS deptAbbreviation ;
        `;
    const result = await pool.query(query, [domainName, domainDescription, deptAbbreviation]);

    return res
      .status(201)
      .json(new ApiResponse(201, result.rows[0], "Domain created successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "The specified department abbreviation does not exist")
      );
    }

    console.error("Domain Creation Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to create domain"));
  }
}

export async function updateDomain(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }
  const { domainId } = req.params;
  const { domainName, domainDescription } = req.body;

  try {
    const query = `
            UPDATE domains 
            SET domain_name = COALESCE($1, domain_name), domain_description = COALESCE($2, domain_description)
            WHERE domain_id = $3 RETURNING *;
        `;
    const result = await pool.query(query, [domainName, domainDescription, domainId]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "Domain not found"));
    }
    return res
      .status(200)
      .json(new ApiResponse(200, result.rows[0], "Domain updated successfully"));
  } catch (err) {
    return next(new ApiError(500, "Database Error", "Failed to update domain"));
  }
}

// GET /api/v1/domains
export async function getAllDomains(req: Request, res: Response, next: NextFunction) {
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
      conditionQuery += ` AND domain_name ILIKE $${paramCounter}`;
      queryParams.push(searchTerm);
      paramCounter++;
    }

    const dataQuery = `
      SELECT * FROM domains
      ${conditionQuery}
      ORDER BY domain_name ASC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1};
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM domains
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
      .json(new ApiResponse(200, responsePayload, "Domains fetched successfully"));
  } catch (error) {
    console.error("Error fetching domains:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to fetch domains"));
  }
}

// GET /api/v1/domains/department/:deptAbbreviation
export async function getDomainsByDept(req: Request, res: Response, next: NextFunction) {
  const { deptAbbreviation } = req.params;

  try {
    const query = `SELECT * FROM domains WHERE dept_abbreviation = $1 ORDER BY domain_name ASC;`;
    const result = await pool.query(query, [deptAbbreviation]);

    return res
      .status(200)
      .json(
        new ApiResponse(200, result.rows, `Domains for ${deptAbbreviation} fetched successfully`)
      );
  } catch (error) {
    console.error("Error fetching department domains:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to fetch department domains"));
  }
}
