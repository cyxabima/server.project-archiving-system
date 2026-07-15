import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes } from "../utils/DbError.js";
export async function createIndustry(req, res, next) {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
    }
    const { industryName, location, industryType, industryEmail } = req.body;
    if (!industryName) {
        return next(new ApiError(422, "Unprocessable Entity", "Industry Name is required"));
    }
    try {
        const query = `
            INSERT INTO industry (industry_name, location, industry_type, industry_email)
            VALUES ($1, $2, $3, $4) 
            RETURNING industry_id AS "industryId", industry_name AS "industryName", location AS "IndustryLocation", industry_email AS "IndustryEmail";
        `;
        const result = await pool.query(query, [industryName, location, industryType, industryEmail]);
        return res
            .status(201)
            .json(new ApiResponse(201, result.rows[0], "Industry created successfully"));
    }
    catch (err) {
        const error = err;
        if (error.code === DbErrorCodes.UNIQUE_VIOLATION) {
            return next(new ApiError(409, "Conflict", "Industry name or email already exists"));
        }
        console.error("Industry Creation Error:", error);
        return next(new ApiError(500, "Database Error", "Failed to create industry"));
    }
}
export async function updateIndustry(req, res, next) {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
    }
    const { industryId } = req.params;
    const { industryName, location, industryType, industryEmail } = req.body;
    try {
        const query = `
            UPDATE industry 
            SET industry_name = COALESCE($1, industry_name), location = COALESCE($2, location), 
                industry_type = COALESCE($3, industry_type), industry_email = COALESCE($4, industry_email)
            WHERE industry_id = $5 RETURNING *;
        `;
        const result = await pool.query(query, [
            industryName,
            location,
            industryType,
            industryEmail,
            industryId
        ]);
        if (result.rowCount === 0) {
            return next(new ApiError(404, "Not Found", "Industry not found"));
        }
        return res
            .status(200)
            .json(new ApiResponse(200, result.rows[0], "Industry updated successfully"));
    }
    catch (err) {
        if (err.code === DbErrorCodes.UNIQUE_VIOLATION)
            return next(new ApiError(409, "Conflict", "Industry name or email already exists"));
        return next(new ApiError(500, "Database Error", "Failed to update industry"));
    }
}
// GET /api/v1/industries
export async function getIndustries(req, res, next) {
    // Default pagination values
    let limit = 20;
    let offset = 0;
    if (req.query.limit) {
        limit = parseInt(req.query.limit, 10);
        if (isNaN(limit))
            limit = 20;
    }
    if (req.query.offset) {
        offset = parseInt(req.query.offset, 10);
        if (isNaN(offset))
            offset = 0;
    }
    try {
        let conditionQuery = `WHERE 1=1`;
        const queryParams = [];
        let paramCounter = 1;
        // Search Parameter (case-insensitive partial match)
        if (req.query.search) {
            const searchTerm = `%${req.query.search}%`;
            conditionQuery += ` AND (industry_name ILIKE $${paramCounter} OR location ILIKE $${paramCounter} OR industry_email ILIKE $${paramCounter})`;
            queryParams.push(searchTerm);
            paramCounter++;
        }
        // Filter = Industry Type
        if (req.query.industryType) {
            conditionQuery += ` AND industry_type = $${paramCounter}`;
            queryParams.push(req.query.industryType);
            paramCounter++;
        }
        const dataQuery = `
      SELECT industry_id, industry_name, location, industry_type, industry_email
      FROM industry
      ${conditionQuery}
      ORDER BY industry_name ASC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1};
    `;
        const countQuery = `
      SELECT COUNT(*) 
      FROM industry
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
            .json(new ApiResponse(200, responsePayload, "Industries fetched successfully"));
    }
    catch (error) {
        console.error("Error fetching industries:", error);
        return next(new ApiError(500, "Internal Server Error", "Failed to fetch industries"));
    }
}
export async function deleteIndustry(req, res, next) {
    const { industryId } = req.params;
    try {
        const query = `
      DELETE FROM industry 
      WHERE industry_id = $1 
      RETURNING industry_id;
    `;
        const result = await pool.query(query, [industryId]);
        if (result.rowCount === 0) {
            return next(new ApiError(404, "Not Found", "Industry not found"));
        }
        return res
            .status(200)
            .json(new ApiResponse(200, null, "Industry deleted successfully"));
    }
    catch (err) {
        if (err.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
            return next(new ApiError(409, "Conflict", "Cannot delete industry because it is currently linked to existing records."));
        }
        console.error("Delete Industry Error:", err);
        return next(new ApiError(500, "Database Error", "Failed to delete industry"));
    }
}
