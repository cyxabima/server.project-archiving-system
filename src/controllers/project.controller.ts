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

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  let limit = 10;
  let offset = 0;

  if (req.query.limit && req.query.offset) {
    limit = parseInt(req.query.limit as string, 10);
    offset = parseInt(req.query.offset as string, 10);
    if (isNaN(limit)) limit = 10;
    if (isNaN(offset)) offset = 0;
  }

  try {
    const dataQuery = ` 
            SELECT 
                p.project_id AS "id",
                p.project_title AS "title",
                p.abstract AS "abstract",
                d.dept_name AS "department",
                p.academic_year AS "batch",
                
                -- DOMAINS (Combines primary domain + any additional domains)
                (
                    SELECT COALESCE(json_agg(DISTINCT dom.domain_name), '[]'::json)
                    FROM (
                        SELECT domain_id FROM projects WHERE project_id = p.project_id
                        UNION
                        SELECT domain_id FROM project_domains WHERE project_id = p.project_id
                    ) all_doms
                    JOIN domains dom ON all_doms.domain_id = dom.domain_id
                ) AS "domains",

                -- SUPERVISORS (Array of Objects)
                (
                    SELECT COALESCE(json_agg(json_build_object('role', pf.supervisory_role, 'name', u.user_name)), '[]'::json)
                    FROM project_faculty pf
                    JOIN users u ON pf.faculty_id = u.user_id
                    WHERE pf.project_id = p.project_id
                ) AS "supervisors",

                -- INDUSTRIES (Array of Objects)
                (
                    SELECT COALESCE(json_agg(json_build_object('name', i.industry_name, 'association', pi.association_type)), '[]'::json)
                    FROM project_industry pi
                    JOIN industry i ON pi.industry_id = i.industry_id
                    WHERE pi.project_id = p.project_id
                ) AS "industries",

                -- GRANTS (Array of Objects)
                (
                    SELECT COALESCE(json_agg(json_build_object('name', g.grant_name, 'amount', g.grant_amount)), '[]'::json)
                    FROM grants g
                    WHERE g.project_id = p.project_id
                ) AS "grants"

            FROM projects p
            JOIN domains d_main ON p.domain_id = d_main.domain_id
            JOIN department d ON d_main.dept_abbreviation = d.dept_abbreviation
            ORDER BY p.project_id DESC
            LIMIT $1 OFFSET $2;
        `;

    const countQuery = `SELECT COUNT(*) FROM projects`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [limit, offset]),
      pool.query(countQuery)
    ]);

    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return res.status(200).json({
      data: dataResult.rows,
      meta: {
        currentPage,
        totalPages,
        totalRecords
      }
    });
  } catch (err: unknown) {
    console.error("Project Retrieval Error:", err);
    return next(new ApiError(500, "Database Error", "Failed to retrieve projects"));
  }
}

export async function searchProject(req: Request, res: Response, next: NextFunction) {
  let searchTerm = null;

  // Grab the search query and wrap it in % for partial matching
  if (req.query.search && typeof req.query.search === "string") {
    searchTerm = `%${req.query.search}%`;
  }
  try {
    // We use a CTE with DISTINCT to guarantee projects never repeat,
    // even if the search term matches multiple fields in the same project!
    const query = `
            WITH FilteredProjects AS (
                SELECT DISTINCT p.project_id
                FROM projects p
                JOIN domains d_main ON p.domain_id = d_main.domain_id
                JOIN department d ON d_main.dept_abbreviation = d.dept_abbreviation
                WHERE ($1::text IS NULL OR 
                    p.project_title ILIKE $1 OR 
                    p.abstract ILIKE $1 OR
                    p.academic_year ILIKE $1 OR 
                    d.dept_name ILIKE $1 OR
                    d_main.domain_name ILIKE $1 OR
                    -- Search in Secondary Domains
                    EXISTS (
                        SELECT 1 FROM project_domains pd 
                        JOIN domains dom ON pd.domain_id = dom.domain_id 
                        WHERE pd.project_id = p.project_id AND dom.domain_name ILIKE $1
                    ) OR
                    -- Search in Supervisors
                    EXISTS (
                        SELECT 1 FROM project_faculty pf 
                        JOIN users u ON pf.faculty_id = u.user_id 
                        WHERE pf.project_id = p.project_id AND u.user_name ILIKE $1
                    ) OR
                    -- Search in Industries
                    EXISTS (
                        SELECT 1 FROM project_industry pi 
                        JOIN industry i ON pi.industry_id = i.industry_id 
                        WHERE pi.project_id = p.project_id AND i.industry_name ILIKE $1
                    )
                )
            )
            SELECT 
                p.project_id AS "id",
                p.project_title AS "title",
                p.abstract AS "abstract",
                d.dept_name AS "department",
                p.academic_year AS "batch",
                
                (
                    SELECT COALESCE(json_agg(dom.domain_name), '[]'::json)
                    FROM (
                        SELECT domain_id FROM projects WHERE project_id = p.project_id
                        UNION
                        SELECT domain_id FROM project_domains WHERE project_id = p.project_id
                    ) all_doms
                    JOIN domains dom ON all_doms.domain_id = dom.domain_id
                ) AS "domains",

                (
                    SELECT COALESCE(json_agg(json_build_object('role', pf.supervisory_role, 'name', u.user_name)), '[]'::json)
                    FROM project_faculty pf
                    JOIN users u ON pf.faculty_id = u.user_id
                    WHERE pf.project_id = p.project_id
                ) AS "supervisors",

                (
                    SELECT COALESCE(json_agg(json_build_object('name', i.industry_name, 'association', pi.association_type)), '[]'::json)
                    FROM project_industry pi
                    JOIN industry i ON pi.industry_id = i.industry_id
                    WHERE pi.project_id = p.project_id
                ) AS "industries",

                (
                    SELECT COALESCE(json_agg(json_build_object('name', g.grant_name, 'amount', g.grant_amount)), '[]'::json)
                    FROM grants g
                    WHERE g.project_id = p.project_id
                ) AS "grants"

            FROM projects p
            JOIN domains d_main ON p.domain_id = d_main.domain_id
            JOIN department d ON d_main.dept_abbreviation = d.dept_abbreviation
            -- This JOIN ensures we only build the JSON for the projects that matched!
            JOIN FilteredProjects fp ON p.project_id = fp.project_id
            ORDER BY p.project_id DESC;
        `;

    const result = await pool.query(query, [searchTerm]);

    return res.status(200).json({
      data: result.rows
    });
  } catch (err: unknown) {
    console.error("Global Search Error:", err);
    return next(new ApiError(500, "Database Error", "Failed to search projects"));
  }
}
