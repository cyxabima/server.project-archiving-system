import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

// GET /api/v1/projects
export async function getProjects(req: Request, res: Response, next: NextFunction) {
    try {
        let queryText = `
            SELECT DISTINCT p.project_id, p.project_title, p.academic_year, p.domain_id, d.dept_abbreviation
            FROM projects p
            JOIN domains d ON p.domain_id = d.domain_id
            LEFT JOIN project_industry pi ON p.project_id = pi.project_id
            WHERE 1=1 
        `;
        
        const queryParams: any[] = [];
        let paramCounter = 1;

        // Filter = Domain ID
        if (req.query.domainId) {
            queryText += ` AND p.domain_id = $${paramCounter}`;
            queryParams.push(req.query.domainId);
            paramCounter++;
        }

        // Filter = Department Abbreviation
        if (req.query.deptAbbreviation) {
            queryText += ` AND d.dept_abbreviation = $${paramCounter}`;
            queryParams.push(req.query.deptAbbreviation);
            paramCounter++;
        }

        // Filter = Industry ID
        if (req.query.industryId) {
            queryText += ` AND pi.industry_id = $${paramCounter}`;
            queryParams.push(req.query.industryId);
            paramCounter++;
        }

        // Filter = Academic Year
        if (req.query.academicYear) {
            queryText += ` AND p.academic_year = $${paramCounter}`;
            queryParams.push(req.query.academicYear);
            paramCounter++;
        }

        queryText += ` ORDER BY p.academic_year DESC, p.project_title ASC;`;

        const result = await pool.query(queryText, queryParams);

        return res.status(200).json(new ApiResponse(200, result.rows, "Projects fetched successfully"));
    } catch (error) {
        console.error("Error fetching projects:", error);
        return next(new ApiError(500, "Internal Server Error", "Failed to fetch projects"));
    }
}