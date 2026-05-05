import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

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
