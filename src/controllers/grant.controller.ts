import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

export async function createGrant(req: Request, res: Response, next: NextFunction) {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
    }

    const { projectId, grantName, recievedDate, grantAmount, industryId } = req.body;

    if ([projectId, grantName, recievedDate, grantAmount, industryId].some(field => field === undefined)) {
        return next(new ApiError(422, "Unprocessable Entity", "All grant fields are required"));
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        
        const query = `
            INSERT INTO grants (project_id, grant_name, recieved_date, grant_amount, industry_id)
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING grant_name AS "grantName", grant_amount AS "grantAmount";
        `;
        const result = await client.query(query, [projectId, grantName, recievedDate, grantAmount, industryId]);
        
        await client.query("COMMIT");
        return res.status(201).json(new ApiResponse(201, result.rows[0], "Grant recorded successfully"));
    } catch (err: unknown) {
        await client.query("ROLLBACK");
        const error = err as DatabaseError;

        if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
            return next(new ApiError(409, "Conflict", "This grant name already exists for this project"));
        }
        if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
            return next(new ApiError(409, "Conflict", "The specified Project ID or Industry ID does not exist"));
        }

        console.error("Grant Creation Error:", error);
        return next(new ApiError(500, "Database Error", "Failed to create grant"));
    } finally {
        client.release();
    }
}

export async function updateGrant(req: Request, res: Response, next: NextFunction) {
    if (!req.body || Object.keys(req.body).length === 0){
        return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
    }
    const { projectId, grantName } = req.params; 
    const { recievedDate, grantAmount, industryId } = req.body;
    const client = await pool.connect();

    try {
        const query = `
            UPDATE grants 
            SET recieved_date = COALESCE($1, recieved_date), grant_amount = COALESCE($2, grant_amount), 
                industry_id = COALESCE($3, industry_id)
            WHERE project_id = $4 AND grant_name = $5 RETURNING *;
        `;
        const result = await client.query(query, [recievedDate, grantAmount, industryId, projectId, grantName]);
        
        if (result.rowCount === 0){
            return next(new ApiError(404, "Not Found", "Grant not found"));
        }
        return res.status(200).json(new ApiResponse(200, result.rows[0], "Grant updated successfully"));
    
    } catch (err: any) {
        if (err.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) return next(new ApiError(409, "Conflict", "Industry ID does not exist"));
        return next(new ApiError(500, "Database Error", "Failed to update grant"));
    
    } finally {
        client.release();
    }
}