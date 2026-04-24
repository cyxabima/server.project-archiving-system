import { NextFunction, Request, Response } from "express";
import ApiError from "../utils/ApiError.js";
import pool from "../db/index.js";
import ApiResponse from "../utils/ApiResponse.js";

export async function addDepartment(req: Request, res: Response, next: NextFunction) {

    // checking obj keys in case of empty {}
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
    }
    
    const { deptAbbreviation, deptName } = req.body;
    
    if ([deptAbbreviation, deptName].some((field)=> !field)){
        return next(new ApiError(422, "Unprocessable Entity", "All fields are required"));
    }

    const client = await pool.connect();
    
    try {
        await client.query("BEGIN");
        const deptQuery = `
            INSERT INTO department (dept_abbreviation, dept_name)
            VALUES ($1, $2) 
            RETURNING 
                dept_abbreviation AS "deptAbbreviation", 
                dept_name AS "deptName";
        `;

        const deptRes = await client.query(deptQuery, [deptAbbreviation, deptName]);
        await client.query("COMMIT");

        return res.status(201).json(new ApiResponse(201, deptRes.rows[0], "Department Added Successfully."));
    }   
    catch (error: any) {
        await client.query("ROLLBACK");
        
        if (error.code === '23505') { 
            return next(new ApiError(409, "Conflict", "Department name or abbreviation already exists"));
        }
        
        console.error("Transaction Error", error);
        return next(new ApiError(500, "DATABASE FAILED", "Failed to execute Query"));
    }
    finally {
        client.release();
    }
}


export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
    if (!req.body || Object.keys(req.body).length === 0){
        return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
    }

    // a patch req like: /departments/:abbreviation: would hit the server

    const oldAbbr = req.params.abbreviation;
    const { deptAbbreviation, deptName } = req.body;

    if (!deptAbbreviation && !deptName){
        return next(new ApiError(400, "Bad Request", "Please provide a name or abbreviation to change."));
    }

    const client = await pool.connect();
    
    try {
        await client.query("BEGIN");
        
        const updateQuery = `
            UPDATE department 
            SET 
                dept_abbreviation = COALESCE($1, dept_abbreviation),
                dept_name = COALESCE($2, dept_name)
            WHERE dept_abbreviation = $3
            RETURNING 
                dept_abbreviation AS "deptAbbreviation", 
                dept_name AS "deptName";
        `;
    
        const result = await client.query(updateQuery, [deptAbbreviation, deptName, oldAbbr]);
      
        if (result.rowCount === 0) {
            await client.query("ROLLBACK");
            return next(new ApiError(404, "Not Found", "Department not found."));
        }

        await client.query("COMMIT");        
        return res.status(200).json(new ApiResponse(200, result.rows[0], "Department updated successfully"));
    } 
    catch (error: any) {
        await client.query("ROLLBACK");
        
        if (error.code === '23505') {
            return next(new ApiError(409, "Conflict", "A Department with this Abbreviation already exists"));
        } 
        
        console.error("Transaction Error", error);
        return next(new ApiError(500, "DATABASE FAILED", "Failed to execute Query"));
    }
    finally{
        client.release();
    } 
}