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
        return next(new ApiError(422, "Unprocessable Entity", "Domain Name and Department Abbreviation are required"));
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        
        const query = `
            INSERT INTO domains (domain_name, domain_description, dept_abbreviation)
            VALUES ($1, $2, $3) 
            RETURNING domain_id AS "domainId", domain_name AS "domainName";
        `;
        const result = await client.query(query, [domainName, domainDescription, deptAbbreviation]);
        
        await client.query("COMMIT");
        return res.status(201).json(new ApiResponse(201, result.rows[0], "Domain created successfully"));
    } catch (err: unknown) {
        await client.query("ROLLBACK");
        const error = err as DatabaseError;

        if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
            return next(new ApiError(409, "Conflict", "The specified department abbreviation does not exist"));
        }
        
        console.error("Domain Creation Error:", error);
        return next(new ApiError(500, "Database Error", "Failed to create domain"));
    } finally {
        client.release();
    }
}

export async function updateDomain(req: Request, res: Response, next: NextFunction) {
    if (!req.body || Object.keys(req.body).length === 0){
      return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
    }
    const { domainId } = req.params;
    const { domainName, domainDescription } = req.body;
    const client = await pool.connect();

    try {
        const query = `
            UPDATE domains 
            SET domain_name = COALESCE($1, domain_name), domain_description = COALESCE($2, domain_description)
            WHERE domain_id = $3 RETURNING *;
        `;
        const result = await client.query(query, [domainName, domainDescription, domainId]);
        
        if (result.rowCount === 0){
          return next(new ApiError(404, "Not Found", "Domain not found"));
        }
        return res.status(200).json(new ApiResponse(200, result.rows[0], "Domain updated successfully"));
    } catch (err) {
        return next(new ApiError(500, "Database Error", "Failed to update domain"));
    } finally {
        client.release();
    }
}

// GET /api/v1/domains
export async function getAllDomains(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(`SELECT * FROM domains ORDER BY domain_name ASC;`);
    return res.status(200).json(new ApiResponse(200, result.rows, "Domains fetched successfully"));
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
