import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";
import { supabase } from "../db/config/supabase.js";

export async function getProjectById(req: Request, res: Response, next: NextFunction) {
  const projectId = req.params.projectId;
  const client = await pool.connect();

  try {
    // 1. Fetch Main Project Details & Group
    const projectRes = await client.query(
      `SELECT p.project_id, p.project_title, p.abstract, p.academic_year, p.dept_abbreviation, g.group_id
       FROM projects p
       LEFT JOIN groups g ON p.project_id = g.project_id
       WHERE p.project_id = $1`,
      [projectId]
    );

    if (projectRes.rows.length === 0) {
      return next(new ApiError(404, "Not Found", "Project not found."));
    }
    const project = projectRes.rows[0];

    // 2. Fetch Domains
    const domainRes = await client.query(
      `SELECT domain_id FROM project_domain WHERE project_id = $1`,
      [projectId]
    );

    // 3. Fetch Faculty Supervisors
    const facultyRes = await client.query(
      `SELECT faculty_id, supervisory_role, remark
       FROM project_faculty WHERE project_id = $1`,
      [projectId]
    );

    // 4. Fetch Industries & Externals (Combined)
    const industryRes = await client.query(
      `SELECT i.industry_name, pi.association_type, pe.ext_email
       FROM project_industry pi
       JOIN industry i ON pi.industry_id = i.industry_id
       LEFT JOIN project_external pe ON pi.project_id = pe.project_id
       -- Note: If multiple externals exist, this join might need tuning based on your strict schema
       WHERE pi.project_id = $1`,
      [projectId]
    );

    // 5. Fetch Grant Details
    const grantRes = await client.query(
      `SELECT g.grant_name, g.grant_amount, g.recieved_date, i.industry_name
       FROM grants g
       JOIN industry i ON g.industry_id = i.industry_id
       WHERE g.project_id = $1`,
      [projectId]
    );

    // 6. Fetch Resources (Files)
    const resourceRes = await client.query(
      `SELECT resource_name, resource_path
       FROM resources WHERE project_id = $1`,
      [projectId]
    );

    // Filter out the grant sponsor from the main industries array to match your frontend logic
    const grantSponsorName = grantRes.rows.length > 0 ? grantRes.rows[0].industry_name : null;
    const standardIndustries = industryRes.rows.filter(
      (ind) => ind.association_type !== "Sponsored" || ind.industry_name !== grantSponsorName
    );

    // Compile the final payload
    const payload = {
      project_id: project.project_id,
      project_title: project.project_title,
      abstract: project.abstract,
      academic_year: project.academic_year,
      group_id: project.group_id,
      domains: domainRes.rows,
      faculty: facultyRes.rows,
      industries: standardIndustries,
      grant: grantRes.rows.length > 0 ? grantRes.rows[0] : null,
      resources: resourceRes.rows,
    };

    return res.status(200).json(new ApiResponse(200, payload, "Project fetched successfully."));
  } catch (error: any) {
    console.error("Error fetching project by ID:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to fetch project details."));
  } finally {
    client.release();
  }
}

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
        conditionQuery += ` AND (
          ARRAY(
            SELECT domain_id FROM project_domain WHERE project_id = p.project_id
            )::varchar[] @> $${paramCounter}::varchar[]
            )`;
            queryParams.push(domainIdsArray);
            paramCounter++;
          }
        }

    //  Archive Toggle Logic
    if (req.query.isDeleted === 'true') {
      conditionQuery += ` AND p.is_deleted = true`;
    } else {
      // Default behavior: only show active projects
      conditionQuery += ` AND p.is_deleted = false`;
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

    // Filter: Domain Name
    if (req.query.domainName && typeof req.query.domainName === "string") {
      conditionQuery += ` AND d_main.domain_name ILIKE $${paramCounter}`;
      queryParams.push(`%${req.query.domainName}%`);
      paramCounter++;
    }

    // Filter: Industry Name
    if (req.query.industryName && typeof req.query.industryName === "string") {
      conditionQuery += ` AND EXISTS (
        SELECT 1 FROM project_industry pi_name
        JOIN industry i_name ON pi_name.industry_id = i_name.industry_id
        WHERE pi_name.project_id = p.project_id AND i_name.industry_name ILIKE $${paramCounter}
      )`;
      queryParams.push(`%${req.query.industryName}%`);
      paramCounter++;
    }

    // Filter: Industry-Linked & Grants
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
            LEFT JOIN project_domain pd_main ON p.project_id = pd_main.project_id
            LEFT JOIN domains d_main ON pd_main.domain_id = d_main.domain_id
            LEFT JOIN department d ON d_main.dept_abbreviation = d.dept_abbreviation
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
            p.academic_year AS "batch",

            -- Fetch the primary department string (LIMIT 1 handles multi-domain crossover)
            (
                SELECT d_sub.dept_name
                FROM project_domain pd_sub
                JOIN domains dom_sub ON pd_sub.domain_id = dom_sub.domain_id
                JOIN department d_sub ON dom_sub.dept_abbreviation = d_sub.dept_abbreviation
                WHERE pd_sub.project_id = p.project_id
                LIMIT 1
            ) AS "department",

            -- Simplified Domain JSON Aggregation (No more UNION!)
            (
                SELECT COALESCE(json_agg(dom.domain_name), '[]'::json)
                FROM project_domain pd_agg
                JOIN domains dom ON pd_agg.domain_id = dom.domain_id
                WHERE pd_agg.project_id = p.project_id
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
            ) AS "grants",

            (
                SELECT COALESCE(json_agg(json_build_object('name', r.resource_name, 'url', r.resource_path, 'type', r.mime_type)), '[]'::json)
                FROM resources r
                WHERE r.project_id = p.project_id
            ) AS "resources"

        FROM projects p
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
            p.academic_year AS "batch",

            -- Fetch the primary department string (LIMIT 1 safely handles multi-domain crossover)
            (
                SELECT d_sub.dept_name
                FROM project_domain pd_sub
                JOIN domains dom_sub ON pd_sub.domain_id = dom_sub.domain_id
                JOIN department d_sub ON dom_sub.dept_abbreviation = d_sub.dept_abbreviation
                WHERE pd_sub.project_id = p.project_id
                LIMIT 1
            ) AS "department",

            -- DOMAINS (Simplified directly from the new many-to-many table)
            (
                SELECT COALESCE(json_agg(dom.domain_name), '[]'::json)
                FROM project_domain pd_agg
                JOIN domains dom ON pd_agg.domain_id = dom.domain_id
                WHERE pd_agg.project_id = p.project_id
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
        ORDER BY p.project_id DESC
        LIMIT $1 OFFSET $2;
    `;

    const countQuery = `SELECT COUNT(*) FROM projects`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [limit, offset]),
      pool.query(countQuery)
    ]);

    // meta data
    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          data: dataResult.rows,
          meta: {
            currentPage,
            totalPages,
            totalRecords
          }
        },
        "Projects listed successfully"
      )
    );
  } catch (err: unknown) {
    console.error("Project Retrieval Error:", err);
    return next(new ApiError(500, "Database Error", "Failed to retrieve projects"));
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  // Extracting Files from Multer
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const reportFile = files?.reportFile?.[0];
  const resourceFile = files?.resourceFile?.[0];

  if (!reportFile) {
    return next(new ApiError(400, "Bad Request", "Project Report (PDF) is mandatory."));
  }

  // Parsing Text Data from FormData
  // Note: FormData sends everything as strings, so we parse JSON strings back into arrays/objects
  const {
    projectTitle,
    abstract,
    academicYear,
    groupId,
    grantIndustryName,
    grantName,
    grantAmount,
    recievedDate
  } = req.body;

  let domainIds: string[] = [];
  let facultySupervisors: { userId: string; role: string; remark?: string }[] = [];
  let industries: { industryName: string; associationType: string; extEmail: string }[] = [];
  try {
    domainIds = JSON.parse(req.body.domainIds);
    facultySupervisors = JSON.parse(req.body.facultySupervisors);
    industries = JSON.parse(req.body.industries || "[]");
  } catch (e) {
    return next(
      new ApiError(400, "Bad Request", "Invalid JSON format for domains or supervisors or industries.")
    );
  }

  if (
    !projectTitle ||
    !abstract ||
    !academicYear ||
    !groupId ||
    domainIds.length === 0 ||
    facultySupervisors.length === 0
  ) {
    return next(
      new ApiError(
        422,
        "Unprocessable Entity",
        "Missing core project details, domains, group, or faculty."
      )
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkGroupRes = await client.query(
      `SELECT project_id FROM groups WHERE group_id = $1`,
      [groupId]
    );

    if (checkGroupRes.rows.length === 0) {
      throw new Error("GROUP_NOT_FOUND");
    }

    // If project_id is strictly not null, the group is already taken
    if (checkGroupRes.rows[0].project_id !== null) {
      throw new Error("GROUP_ALREADY_ASSIGNED");
    }

    // Create Project
    const primaryDomainId = domainIds[0];
    const deptRes = await client.query(
      `SELECT dept_abbreviation FROM domains WHERE domain_id = $1`,
      [primaryDomainId]
    );

    if (deptRes.rows.length === 0) {
      throw new Error("DOMAIN_NOT_FOUND");
    }
    const deptAbbr = deptRes.rows[0].dept_abbreviation;

    const projectRes = await client.query(
      `INSERT INTO projects (project_title, abstract, academic_year, dept_abbreviation)
       VALUES ($1, $2, $3, $4) RETURNING project_id;`,
      [projectTitle, abstract, academicYear, deptAbbr]
    );
    const projectId = projectRes.rows[0].project_id;

    // Link the Group
    const groupRes = await client.query(
      `UPDATE groups SET project_id = $1 WHERE group_id = $2 RETURNING group_id;`,
      [projectId, groupId]
    );
    if (groupRes.rowCount === 0) throw new Error("GROUP_NOT_FOUND");

    // All Domains
    for (const domainId of domainIds) {
      await client.query(`INSERT INTO project_domain (project_id, domain_id) VALUES ($1, $2);`, [
        projectId,
        domainId
      ]);
    }

    // Faculty Supervisors
    for (const faculty of facultySupervisors) {
      await client.query(
        `INSERT INTO project_faculty (project_id, faculty_id, supervisory_role, remark)
         VALUES ($1, $2, $3, $4);`,
        [projectId, faculty.userId, faculty.role, faculty.remark || null]
      );
    }

    // Industry, External & Grants
    const linkedIndustryIds = new Set(); // Track linked IDs to prevent duplicate inserts later

    for (const ind of industries) {
      if (!ind.industryName) continue;

      // Find Industry ID
      const indRes = await client.query(
        `SELECT industry_id FROM industry WHERE industry_name = $1`,
        [ind.industryName]
      );
      if (indRes.rows.length === 0) throw new Error(`INDUSTRY_NOT_FOUND:${ind.industryName}`);
      const industryId = indRes.rows[0].industry_id;

      // Link project to industry
      await client.query(
        `INSERT INTO project_industry (project_id, industry_id, association_type) VALUES ($1, $2, $3);`,
        [projectId, industryId, ind.associationType || "Partner"]
      );
      linkedIndustryIds.add(industryId);

      // Link External Supervisor if provided
      if (ind.extEmail) {
        const extRes = await client.query(
          `SELECT ext_email FROM external_superv WHERE ext_email = $1`,
          [ind.extEmail]
        );
        if (extRes.rows.length === 0) throw new Error(`EXTERNAL_NOT_FOUND:${ind.extEmail}`);

        await client.query(
          `INSERT INTO project_external (project_id, ext_email, industry_feedback) VALUES ($1, $2, NULL);`,
          [projectId, ind.extEmail]
        );
      }
    }

      // Grants
      if (grantIndustryName && grantName) {
      const grantIndRes = await client.query(
        `SELECT industry_id FROM industry WHERE industry_name = $1`,
        [grantIndustryName]
      );
      if (grantIndRes.rows.length === 0) throw new Error(`INDUSTRY_NOT_FOUND:${grantIndustryName}`);
      const grantIndustryId = grantIndRes.rows[0].industry_id;

      // Ensure the sponsoring industry is linked to the project as "Sponsored"
      // If it wasn't already linked via the arrays above, insert it now.
      if (!linkedIndustryIds.has(grantIndustryId)) {
        await client.query(
          `INSERT INTO project_industry (project_id, industry_id, association_type) VALUES ($1, $2, $3);`,
          [projectId, grantIndustryId, "Sponsored"]
        );
      }

      // Insert Grant Record
      await client.query(
        `INSERT INTO grants (project_id, grant_name, recieved_date, grant_amount, industry_id)
         VALUES ($1, $2, $3, $4, $5);`,
        [projectId, grantName, recievedDate || null, grantAmount || null, grantIndustryId]
      );
    }

    // STEP 6: Upload to Supabase Buckets
    // Format: projects/Batch/{projectID}+{projectTitle}/filename
    // Removing spaces/special chars for URL safety
    const safeTitle = projectTitle.replace(/[^a-zA-Z0-9]/g, "_");
    const basePath = `projects/${academicYear}/${projectId}_${safeTitle}`;

    const uploadedResources = [];

    // Upload Report
    const reportPath = `${basePath}/${reportFile.originalname}`;
    const { error: reportErr } = await supabase.storage
      .from("project-resources")
      .upload(reportPath, reportFile.buffer, { contentType: reportFile.mimetype });
    if (reportErr) throw new Error("SUPABASE_UPLOAD_FAILED");

    // storing Public URL to DB
    const reportUrl = supabase.storage.from("project-resources").getPublicUrl(reportPath)
      .data.publicUrl;
    await client.query(
      `INSERT INTO resources (project_id, resource_name, resource_path, mime_type) VALUES ($1, $2, $3, $4);`,
      [projectId, "Report", reportUrl, reportFile.mimetype]
    );
    uploadedResources.push({ name: "Report", url: reportUrl });

    // Upload ZIP Resource
    if (resourceFile) {
      const zipPath = `${basePath}/${resourceFile.originalname}`;
      const { error: zipErr } = await supabase.storage
        .from("project-resources")
        .upload(zipPath, resourceFile.buffer, { contentType: resourceFile.mimetype });
      if (zipErr) throw new Error("SUPABASE_UPLOAD_FAILED");

      const zipUrl = supabase.storage.from("project-resources").getPublicUrl(zipPath)
        .data.publicUrl;
      await client.query(
        `INSERT INTO resources (project_id, resource_name, resource_path, mime_type) VALUES ($1, $2, $3, $4);`,
        [projectId, "Source Code / Assets", zipUrl, resourceFile.mimetype]
      );
      uploadedResources.push({ name: "Source Code / Assets", url: zipUrl });
    }

    await client.query("COMMIT");

    const finalPayload = {
      projectId,
      projectTitle,
      abstract,
      academicYear,
      groupId,
      domains: domainIds,
      facultySupervisors,
      industriesLinked: industries.length,
      grantDetails: grantName ? { grantName, grantIndustryName, grantAmount } : null,
      resources: uploadedResources
    };

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          finalPayload,
          "Project completely registered and files uploaded successfully."
        )
      );
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Project Creation Transaction Failed:", error);

    if (error.message === "GROUP_ALREADY_ASSIGNED") {
      return next(new ApiError(409, "Conflict", "The selected group is already assigned to an existing project."));
    }
    if (error.message === "GROUP_NOT_FOUND") {
      return next(new ApiError(404, "Not Found", "Provided Group ID does not exist."));
    }
    if (error.message.startsWith("INDUSTRY_NOT_FOUND")) {
      const missingName = error.message.split(":")[1];
      return next(new ApiError(404, "Not Found", `Industry '${missingName}' does not exist.`));
    }
    if (error.message.startsWith("EXTERNAL_NOT_FOUND")) {
      const missingEmail = error.message.split(":")[1];
      return next(new ApiError(404, "Not Found", `External supervisor '${missingEmail}' does not exist.`));
    }
    if (error.message === "SUPABASE_UPLOAD_FAILED") {
      return next(
        new ApiError(502, "Bad Gateway", "Failed to upload files to cloud storage. Database changes rolled back.")
      );
    }

    const dbError = error as DatabaseError;
    if (dbError.code === DbErrorCodes.UNIQUE_VIOLATION)
      return next(new ApiError(409, "Conflict", "A project with this title already exists."));
    if (dbError.code === DbErrorCodes.FOREIGN_KEY_VIOLATION)
      return next(
        new ApiError(409, "Conflict", "One of the provided Domain IDs or Faculty IDs is invalid.")
      );

    return next(
      new ApiError(500, "Internal Server Error", "Failed to complete project registration process.")
    );
  } finally {
    client.release();
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  const projectId = req.params.projectId;

  // Extract Optional Files
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const reportFile = files?.reportFile?.[0];
  const resourceFile = files?.resourceFile?.[0];

  // Parse Text Data
  const {
    projectTitle,
    abstract,
    academicYear,
    groupId,
    grantIndustryName,
    grantName,
    grantAmount,
    recievedDate
  } = req.body;

  let domainIds: string[] = [];
  let facultySupervisors: { userId: string; role: string; remark?: string }[] = [];
  let industries: { industryName: string; associationType: string; extEmail: string }[] = [];

  try {
    if (req.body.domainIds) domainIds = JSON.parse(req.body.domainIds);
    if (req.body.facultySupervisors) facultySupervisors = JSON.parse(req.body.facultySupervisors);
    if (req.body.industries) industries = JSON.parse(req.body.industries);
  } catch (e) {
    return next(new ApiError(400, "Bad Request", "Invalid JSON format for arrays."));
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projCheck = await client.query(`SELECT project_id FROM projects WHERE project_id = $1`, [projectId]);
    if (projCheck.rows.length === 0) throw new Error("PROJECT_NOT_FOUND");

    const currentGroupRes = await client.query(`SELECT group_id FROM groups WHERE project_id = $1`, [projectId]);
    const currentGroupId = currentGroupRes.rows.length > 0 ? currentGroupRes.rows[0].group_id : null;

    if (currentGroupId !== groupId) {
      const checkNewGroup = await client.query(`SELECT project_id FROM groups WHERE group_id = $1`, [groupId]);
      if (checkNewGroup.rows.length === 0) throw new Error("GROUP_NOT_FOUND");
      if (checkNewGroup.rows[0].project_id !== null && checkNewGroup.rows[0].project_id !== projectId) {
        throw new Error("GROUP_ALREADY_ASSIGNED");
      }
      await client.query(`UPDATE groups SET project_id = NULL WHERE project_id = $1`, [projectId]);
      await client.query(`UPDATE groups SET project_id = $1 WHERE group_id = $2`, [projectId, groupId]);
    }

    let deptAbbr = null;
    if (domainIds.length > 0) {
      const deptRes = await client.query(`SELECT dept_abbreviation FROM domains WHERE domain_id = $1`, [domainIds[0]]);
      if (deptRes.rows.length > 0) deptAbbr = deptRes.rows[0].dept_abbreviation;
    }

    await client.query(
      `UPDATE projects SET project_title = $1, abstract = $2, academic_year = $3, dept_abbreviation = COALESCE($4, dept_abbreviation) WHERE project_id = $5`,
      [projectTitle, abstract, academicYear, deptAbbr, projectId]
    );

    await client.query(`DELETE FROM project_domain WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM project_faculty WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM project_industry WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM project_external WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM grants WHERE project_id = $1`, [projectId]);

    for (const domainId of domainIds) {
      await client.query(`INSERT INTO project_domain (project_id, domain_id) VALUES ($1, $2);`, [projectId, domainId]);
    }
    for (const faculty of facultySupervisors) {
      await client.query(
        `INSERT INTO project_faculty (project_id, faculty_id, supervisory_role, remark) VALUES ($1, $2, $3, $4);`,
        [projectId, faculty.userId, faculty.role, faculty.remark || null]
      );
    }

    const linkedIndustryIds = new Set();
    for (const ind of industries) {
      if (!ind.industryName) continue;

      const indRes = await client.query(`SELECT industry_id FROM industry WHERE industry_name = $1`, [ind.industryName]);
      if (indRes.rows.length === 0) throw new Error(`INDUSTRY_NOT_FOUND:${ind.industryName}`);
      const industryId = indRes.rows[0].industry_id;

      await client.query(
        `INSERT INTO project_industry (project_id, industry_id, association_type) VALUES ($1, $2, $3);`,
        [projectId, industryId, ind.associationType || "Partner"]
      );
      linkedIndustryIds.add(industryId);

      if (ind.extEmail) {
        await client.query(`INSERT INTO project_external (project_id, ext_email, industry_feedback) VALUES ($1, $2, NULL);`, [projectId, ind.extEmail]);
      }
    }

    if (grantIndustryName && grantName) {
      const grantIndRes = await client.query(`SELECT industry_id FROM industry WHERE industry_name = $1`, [grantIndustryName]);
      if (grantIndRes.rows.length === 0) throw new Error(`INDUSTRY_NOT_FOUND:${grantIndustryName}`);
      const grantIndustryId = grantIndRes.rows[0].industry_id;

      if (!linkedIndustryIds.has(grantIndustryId)) {
        await client.query(
          `INSERT INTO project_industry (project_id, industry_id, association_type) VALUES ($1, $2, $3);`,
          [projectId, grantIndustryId, "Sponsored"]
        );
      }
      await client.query(
        `INSERT INTO grants (project_id, grant_name, recieved_date, grant_amount, industry_id) VALUES ($1, $2, $3, $4, $5);`,
        [projectId, grantName, recievedDate || null, grantAmount || null, grantIndustryId]
      );
    }

    const safeTitle = projectTitle.replace(/[^a-zA-Z0-9]/g, "_");
    const basePath = `projects/${academicYear}/${projectId}_${safeTitle}`;

    if (reportFile) {
      const reportPath = `${basePath}/${reportFile.originalname}`;
      await supabase.storage.from("project-resources").upload(reportPath, reportFile.buffer, { contentType: reportFile.mimetype, upsert: true });
      const reportUrl = supabase.storage.from("project-resources").getPublicUrl(reportPath).data.publicUrl;

      await client.query(`DELETE FROM resources WHERE project_id = $1 AND resource_name = 'Report'`, [projectId]);
      await client.query(`INSERT INTO resources (project_id, resource_name, resource_path, mime_type) VALUES ($1, $2, $3, $4);`, [projectId, "Report", reportUrl, reportFile.mimetype]);
    }

    if (resourceFile) {
      const zipPath = `${basePath}/${resourceFile.originalname}`;
      await supabase.storage.from("project-resources").upload(zipPath, resourceFile.buffer, { contentType: resourceFile.mimetype, upsert: true });
      const zipUrl = supabase.storage.from("project-resources").getPublicUrl(zipPath).data.publicUrl;

      await client.query(`DELETE FROM resources WHERE project_id = $1 AND resource_name = 'Source Code / Assets'`, [projectId]);
      await client.query(`INSERT INTO resources (project_id, resource_name, resource_path, mime_type) VALUES ($1, $2, $3, $4);`, [projectId, "Source Code / Assets", zipUrl, resourceFile.mimetype]);
    }

    await client.query("COMMIT");

    return res.status(200).json(new ApiResponse(200, { projectId }, "Project updated successfully."));
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Update Transaction Failed:", error);

    if (error.message === "PROJECT_NOT_FOUND") return next(new ApiError(404, "Not Found", "Project not found."));
    if (error.message === "GROUP_ALREADY_ASSIGNED") return next(new ApiError(409, "Conflict", "The selected group is already assigned to another project."));
    if (error.message === "GROUP_NOT_FOUND") return next(new ApiError(404, "Not Found", "Provided Group ID does not exist."));
    if (error.message.startsWith("INDUSTRY_NOT_FOUND")) return next(new ApiError(404, "Not Found", `Industry '${error.message.split(":")[1]}' does not exist.`));

    return next(new ApiError(500, "Internal Server Error", "Failed to update project."));
  } finally {
    client.release();
  }
}

export async function archiveProject(req: Request, res: Response, next: NextFunction) {
  const projectId = req.params.projectId;

  if (!projectId) { return next(new ApiError(400, "Bad Request", "Project ID is required.")); }

  try {
    const result = await pool.query(
      `UPDATE projects SET is_deleted = true WHERE project_id = $1 AND is_deleted = false RETURNING project_id, project_title`,
      [projectId]
    );

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "Project not found or already archived."));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result.rows[0],
          `Project '${result.rows[0].project_title}' archived successfully.`
        )
      );
  } catch (error) {
    console.error("Error archiving project:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to archive project."));
  }
}