import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

// GET /api/v1/dashboard/stats
export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectDeptAbbrev, studentDeptAbbrev, studentBatch } = req.query;

    const masterQuery = `
      SELECT 
        (SELECT COUNT(*) FROM faculty) AS "totalFaculty",
        (SELECT COUNT(DISTINCT faculty_id) FROM project_faculty) AS "totalSupervisingFaculty",
        (SELECT COUNT(*) FROM external_superv) AS "totalExternals",
        (SELECT COUNT(*) FROM industry) AS "totalIndustries",
        (SELECT COUNT(*) FROM department) AS "totalDept",
        (SELECT COUNT(*) FROM domains) AS "totalDomain",
        (SELECT COUNT(*) FROM projects) AS "totalProject",
        (SELECT COUNT(*) FROM staff) AS "totalStaff",
        (SELECT COUNT(*) FROM users) AS "totalUsers",
        (SELECT COUNT(*) FROM students) AS "totalStudent";
    `;

    const masterResult = await pool.query(masterQuery);

    const rawCounts = masterResult.rows[0];
    const dashboardData: Record<string, number | null> = {
      totalFaculty: parseInt(rawCounts.totalFaculty, 10),
      totalSupervisingFaculty: parseInt(rawCounts.totalSupervisingFaculty, 10),
      totalExternals: parseInt(rawCounts.totalExternals, 10),
      totalIndustries: parseInt(rawCounts.totalIndustries, 10),
      totalDept: parseInt(rawCounts.totalDept, 10),
      totalDomain: parseInt(rawCounts.totalDomain, 10),
      totalProject: parseInt(rawCounts.totalProject, 10),
      totalStaff: parseInt(rawCounts.totalStaff, 10),
      totalUsers: parseInt(rawCounts.totalUsers, 10),
      totalStudent: parseInt(rawCounts.totalStudent, 10),
      projectsByDept: null, // Defaults
      studentsByFilter: null
    };

    // Projects by Department
    if (projectDeptAbbrev) {
      const projRes = await pool.query(
        `SELECT COUNT(*) FROM projects WHERE dept_abbreviation = $1`,
        [projectDeptAbbrev]
      );
      dashboardData.projectsByDept = parseInt(projRes.rows[0].count, 10);
    }

    //Students by Department & Batch
    if (studentDeptAbbrev || studentBatch) {
      let studentQuery = `SELECT COUNT(*) FROM students WHERE 1=1`;
      const studentParams: any[] = [];
      let paramCounter = 1;

      if (studentDeptAbbrev) {
        studentQuery += ` AND dept_abbreviation = $${paramCounter}`;
        studentParams.push(studentDeptAbbrev);
        paramCounter++;
      }

      if (studentBatch) {
        studentQuery += ` AND batch = $${paramCounter}`;
        studentParams.push(studentBatch);
        paramCounter++;
      }

      const stdRes = await pool.query(studentQuery, studentParams);
      dashboardData.studentsByFilter = parseInt(stdRes.rows[0].count, 10);
    }

    return res
      .status(200)
      .json(new ApiResponse(200, dashboardData, "Dashboard statistics retrieved successfully"));
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return next(
      new ApiError(500, "Internal Server Error", "Failed to retrieve dashboard statistics")
    );
  }
}
