import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

// GET /api/v1/projects/getProjects
export async function getProjects(req: Request, res: Response, next: NextFunction) {
  let limit = 10;
  let offset = 0;

  if (req.query.limit && req.query.offset) {
    limit = parseInt(req.query.limit as string, 10);
    offset = parseInt(req.query.offset as string, 10);
    if (isNaN(limit)) limit = 10;
    if (isNaN(offset)) offset = 0;
  }

  try {
    let conditionQuery = `WHERE 1=1`;
    const queryParams: any[] = [];
    let paramCounter = 1;

    // Filter: Domain IDs
    if (req.query.domainId) {
      let domainIdsArray: string[] = [];
      if (typeof req.query.domainId === "string") {
        domainIdsArray = req.query.domainId.split(",");
      } else if (Array.isArray(req.query.domainId)) {
        domainIdsArray = req.query.domainId as string[];
      }

      if (domainIdsArray.length > 0) {
        // The @> is ==> Contains
        conditionQuery += ` AND (
          ARRAY(
            SELECT domain_id FROM projects WHERE project_id = p.project_id
            UNION
            SELECT domain_id FROM project_domains WHERE project_id = p.project_id
          )::varchar[] @> $${paramCounter}::varchar[]
        )`;
        queryParams.push(domainIdsArray);
        paramCounter++;
      }
    }

    // Filter: Department Abbreviation
    if (req.query.deptAbbreviation) {
      conditionQuery += ` AND d.dept_abbreviation = $${paramCounter}`;
      queryParams.push(req.query.deptAbbreviation);
      paramCounter++;
    }

    // Filter: Industry ID
    if (req.query.industryId) {
      conditionQuery += ` AND pi.industry_id = $${paramCounter}`;
      queryParams.push(req.query.industryId);
      paramCounter++;
    }

    // Filter: Academic Year
    if (req.query.academicYear) {
      conditionQuery += ` AND p.academic_year = $${paramCounter}`;
      queryParams.push(req.query.academicYear);
      paramCounter++;
    }

    // Filter: Domain Name (Case-Insensitive)
    if (req.query.domainName && typeof req.query.domainName === "string") {
      conditionQuery += ` AND (
        d_main.domain_name ILIKE $${paramCounter} OR 
        EXISTS (
            SELECT 1 FROM project_domains pd_name 
            JOIN domains dom_name ON pd_name.domain_id = dom_name.domain_id 
            WHERE pd_name.project_id = p.project_id AND dom_name.domain_name ILIKE $${paramCounter}
        )
      )`;
      queryParams.push(`%${req.query.domainName}%`);
      paramCounter++;
    }

    // Filter: Industry Name (Case-Insensitive)
    if (req.query.industryName && typeof req.query.industryName === "string") {
      conditionQuery += ` AND EXISTS (
        SELECT 1 FROM project_industry pi_name 
        JOIN industry i_name ON pi_name.industry_id = i_name.industry_id 
        WHERE pi_name.project_id = p.project_id AND i_name.industry_name ILIKE $${paramCounter}
      )`;
      queryParams.push(`%${req.query.industryName}%`);
      paramCounter++;
    }

    // Filter: Industry-Linked & Grants (sponsored)
    if (req.query.industries && typeof req.query.industries === "string") {
      const industriesArray = req.query.industries.split(",");

      if (industriesArray.includes("Industry-Linked")) {
        conditionQuery += ` AND EXISTS (
          SELECT 1 FROM project_industry pi_check WHERE pi_check.project_id = p.project_id
        )`;
      }

      if (industriesArray.includes("Received Grant")) {
        conditionQuery += ` AND EXISTS (
          SELECT 1 FROM grants g WHERE g.project_id = p.project_id
        )`;
      }
    }

    // Filter: Global Search
    if (req.query.search && typeof req.query.search === "string") {
      conditionQuery += ` AND (
        p.project_title ILIKE $${paramCounter} OR 
        p.abstract ILIKE $${paramCounter} OR
        p.academic_year ILIKE $${paramCounter} OR 
        d.dept_name ILIKE $${paramCounter} OR
        d_main.domain_name ILIKE $${paramCounter} OR
        EXISTS (
            SELECT 1 FROM project_domains pd_search 
            JOIN domains dom_search ON pd_search.domain_id = dom_search.domain_id 
            WHERE pd_search.project_id = p.project_id AND dom_search.domain_name ILIKE $${paramCounter}
        ) OR
        EXISTS (
            SELECT 1 FROM project_faculty pf_search 
            JOIN users u_search ON pf_search.faculty_id = u_search.user_id 
            WHERE pf_search.project_id = p.project_id AND u_search.user_name ILIKE $${paramCounter}
        ) OR
        EXISTS (
            SELECT 1 FROM project_industry pi_search 
            JOIN industry i_search ON pi_search.industry_id = i_search.industry_id 
            WHERE pi_search.project_id = p.project_id AND i_search.industry_name ILIKE $${paramCounter}
        )
      )`;
      queryParams.push(`%${req.query.search}%`);
      paramCounter++;
    }

    const cteQuery = `
        WITH FilteredProjects AS (
            SELECT DISTINCT p.project_id
            FROM projects p
            JOIN domains d_main ON p.domain_id = d_main.domain_id
            JOIN department d ON d_main.dept_abbreviation = d.dept_abbreviation
            LEFT JOIN project_industry pi ON p.project_id = pi.project_id
            ${conditionQuery}
        )
    `;

    const dataQuery = `
        ${cteQuery}
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
                SELECT COALESCE(json_agg(json_build_object('name', i.industry_name, 'association', pi_agg.association_type)), '[]'::json)
                FROM project_industry pi_agg
                JOIN industry i ON pi_agg.industry_id = i.industry_id
                WHERE pi_agg.project_id = p.project_id
            ) AS "industries",

            (
                SELECT COALESCE(json_agg(json_build_object('name', g.grant_name, 'amount', g.grant_amount)), '[]'::json)
                FROM grants g
                WHERE g.project_id = p.project_id
            ) AS "grants"

        FROM projects p
        JOIN domains d_main ON p.domain_id = d_main.domain_id
        JOIN department d ON d_main.dept_abbreviation = d.dept_abbreviation
        JOIN FilteredProjects fp ON p.project_id = fp.project_id
        ORDER BY p.academic_year DESC, p.project_title ASC
        LIMIT $${paramCounter} OFFSET $${paramCounter + 1};
    `;

    const countQuery = `
        ${cteQuery}
        SELECT COUNT(*) FROM FilteredProjects;
    `;

    const dataParams = [...queryParams, limit, offset];

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, dataParams),
      pool.query(countQuery, queryParams)
    ]);

    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    // Build Final Payload
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
      .json(new ApiResponse(200, responsePayload, "Projects fetched successfully"));
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
