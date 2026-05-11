import { NextFunction, Request, Response } from "express";
import pool from "../db/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { DbErrorCodes, DatabaseError } from "../utils/DbError.js";

// POST /api/v1/groups
export async function createGroup(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { groupLeader, member2, member3, member4, projectId } = req.body;

  if (!groupLeader) {
    return next(new ApiError(422, "Unprocessable Entity", "Group Leader is required"));
  }

  // filtering out undefined/null
  const proposedMembers = [groupLeader, member2, member3, member4].filter(Boolean);

  // killign duplicate
  const uniqueMembers = new Set(proposedMembers);
  if (uniqueMembers.size !== proposedMembers.length) {
    return next(
      new ApiError(
        400,
        "Bad Request",
        "A student cannot occupy multiple roles within the same group"
      )
    );
  }

  try {
    // checking if any of these students exist in ANY group columns
    const checkQuery = `
            SELECT group_id FROM groups 
            WHERE group_leader = ANY($1) 
               OR member_2 = ANY($1) 
               OR member_3 = ANY($1) 
               OR member_4 = ANY($1);
        `;
    const checkResult = await pool.query(checkQuery, [proposedMembers]);

    if (checkResult.rowCount && checkResult.rowCount > 0) {
      return next(
        new ApiError(
          409,
          "Conflict",
          "One or more of the provided students are already assigned to a group"
        )
      );
    }

    const insertQuery = `
            INSERT INTO groups (group_leader, member_2, member_3, member_4, project_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
    const result = await pool.query(insertQuery, [
      groupLeader,
      member2 || null,
      member3 || null,
      member4 || null,
      projectId || null
    ]);

    return res.status(201).json(new ApiResponse(201, result.rows[0], "Group created successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "One or more Seat Numbers or the Project ID do not exist")
      );
    }

    console.error("Group Creation Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to create group"));
  }
}

// PATCH /api/v1/groups/:groupId
export async function updateGroup(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ApiError(422, "Unprocessable Entity", "Body is missing"));
  }

  const { groupId } = req.params;
  const { groupLeader, member2, member3, member4, projectId } = req.body;

  const proposedMembers = [groupLeader, member2, member3, member4].filter(Boolean);

  if (proposedMembers.length > 0) {
    // Node.js Intra-group duplicate check
    const uniqueMembers = new Set(proposedMembers);
    if (uniqueMembers.size !== proposedMembers.length) {
      return next(
        new ApiError(
          400,
          "Bad Request",
          "A student cannot occupy multiple roles within the same group"
        )
      );
    }
  }

  try {
    if (proposedMembers.length > 0) {
      // check but excluding the current group we are updating
      const checkQuery = `
                SELECT group_id FROM groups 
                WHERE group_id != $2 AND (
                    group_leader = ANY($1) OR member_2 = ANY($1) OR 
                    member_3 = ANY($1) OR member_4 = ANY($1)
                );
            `;
      const checkResult = await pool.query(checkQuery, [proposedMembers, groupId]);

      if (checkResult.rowCount && checkResult.rowCount > 0) {
        return next(
          new ApiError(
            409,
            "Conflict",
            "One or more students are already assigned to a DIFFERENT group"
          )
        );
      }
    }

    const updateQuery = `
            UPDATE groups 
            SET group_leader = COALESCE($1, group_leader),
                member_2 = COALESCE($2, member_2),
                member_3 = COALESCE($3, member_3),
                member_4 = COALESCE($4, member_4),
                project_id = COALESCE($5, project_id)
            WHERE group_id = $6
            RETURNING *;
        `;
    const result = await pool.query(updateQuery, [
      groupLeader,
      member2,
      member3,
      member4,
      projectId,
      groupId
    ]);

    if (result.rowCount === 0) {
      return next(new ApiError(404, "Not Found", "Group not found"));
    }

    return res.status(200).json(new ApiResponse(200, result.rows[0], "Group updated successfully"));
  } catch (err: unknown) {
    const error = err as DatabaseError;

    if (error.code === DbErrorCodes.FOREIGN_KEY_VIOLATION) {
      return next(
        new ApiError(409, "Conflict", "One or more Seat Numbers or the Project ID do not exist")
      );
    }

    console.error("Group Update Error:", error);
    return next(new ApiError(500, "Database Error", "Failed to update group"));
  }
}

export async function getGroups(req: Request, res: Response, next: NextFunction) {
  try {
    let queryText = `
      SELECT group_id, group_leader, member_2, member_3, member_4, project_id
      FROM groups
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramCounter = 1;

    // Filter = Project ID
    if (req.query.projectId) {
      queryText += ` AND project_id = $${paramCounter}`;
      queryParams.push(req.query.projectId);
      paramCounter++;
    }

    // Filter = Student SeatNo. (in any member slot)
    if (req.query.seatNo) {
      queryText += ` AND (group_leader = $${paramCounter} OR member_2 = $${paramCounter} OR member_3 = $${paramCounter} OR member_4 = $${paramCounter})`;
      queryParams.push(req.query.seatNo);
      paramCounter++;
    }

    queryText += ` ORDER BY group_id ASC;`;

    const result = await pool.query(queryText, queryParams);

    return res.status(200).json(new ApiResponse(200, result.rows, "Groups fetched successfully"));
  } catch (error) {
    console.error("Error fetching groups:", error);
    return next(new ApiError(500, "Internal Server Error", "Failed to fetch groups"));
  }
}
