import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

export async function getComprehensiveReport(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Core Summary Metrics
    const summaryQuery = `
      SELECT 
        (SELECT COUNT(*) FROM students) AS total_students,
        (SELECT COUNT(*) FROM groups) AS total_groups,
        (SELECT COUNT(*) FROM department) AS total_departments,
        (SELECT COUNT(*) FROM industry) AS total_industries,
        (SELECT COUNT(*) FROM external_superv) AS total_externals
    `;
    const summaryResult = await pool.query(summaryQuery);
    const summaryData = summaryResult.rows[0];

    // 2. Departmental Breakdown
    const deptQuery = `
      SELECT 
        d.dept_abbreviation AS "deptAbbreviation", 
        COUNT(s.seat_no) AS "studentCount"
      FROM department d
      LEFT JOIN students s ON d.dept_abbreviation = s.dept_abbreviation
      GROUP BY d.dept_abbreviation
      ORDER BY "studentCount" DESC;
    `;
    const deptResult = await pool.query(deptQuery);

    // 3. Audit: Unassigned Groups
    const unassignedGroupsQuery = `
      SELECT group_id AS "groupId", group_leader AS "groupLeader"
      FROM groups 
      WHERE project_id IS NULL
      ORDER BY group_id ASC;
    `;
    const unassignedGroupsResult = await pool.query(unassignedGroupsQuery);

    // 4. Audit: Unassigned Students (Not in any group)
    const unassignedStudentsQuery = `
      SELECT seat_no AS "seatNo", std_name AS "stdName"
      FROM students
      WHERE seat_no NOT IN (
        SELECT group_leader FROM groups WHERE group_leader IS NOT NULL
        UNION SELECT member_2 FROM groups WHERE member_2 IS NOT NULL
        UNION SELECT member_3 FROM groups WHERE member_3 IS NOT NULL
        UNION SELECT member_4 FROM groups WHERE member_4 IS NOT NULL
      )
      ORDER BY seat_no ASC;
    `;
    const unassignedStudentsResult = await pool.query(unassignedStudentsQuery);

    // 5. Audit: Empty Industries (No external supervisors linked)
    const emptyIndustriesQuery = `
      SELECT industry_id AS "industryId", industry_name AS "industryName"
      FROM industry
      WHERE industry_id NOT IN (
        SELECT industry_id FROM external_superv WHERE industry_id IS NOT NULL
      )
      ORDER BY industry_name ASC;
    `;
    const emptyIndustriesResult = await pool.query(emptyIndustriesQuery);

    // Assemble the complete payload
    const reportPayload = {
      summary: {
        totalStudents: parseInt(summaryData.total_students, 10),
        totalGroups: parseInt(summaryData.total_groups, 10),
        totalDepartments: parseInt(summaryData.total_departments, 10),
        totalIndustries: parseInt(summaryData.total_industries, 10),
        totalExternals: parseInt(summaryData.total_externals, 10),
      },
      departmentStats: deptResult.rows.map((r: any) => ({
        deptAbbreviation: r.deptAbbreviation,
        studentCount: parseInt(r.studentCount, 10)
      })),
      actionItems: {
        unassignedGroups: unassignedGroupsResult.rows,
        unassignedStudents: unassignedStudentsResult.rows,
        emptyIndustries: emptyIndustriesResult.rows
      }
    };

    return res
      .status(200)
      .json(new ApiResponse(200, reportPayload, "Comprehensive reports generated successfully"));
  } catch (error) {
    console.error("Reporting Error:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to generate reports"));
  }
}
