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
        return res.status(201).json(new ApiResponse(201, result.rows[0], "Industry created successfully"));
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