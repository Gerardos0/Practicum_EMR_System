import type { Discipline, RosterRow, User } from "../types";
import { ApiError, clone, latency, uid } from "./client";
import { db } from "./mockDb";
import { recordAudit } from "./audit";

export async function listRoster(courseId: string): Promise<User[]> {
  await latency(150);
  return clone(
    db.users.filter((u) => u.roles.some((r) => r.role === "student" && r.courseIds.includes(courseId))),
  );
}

/** Adds students to a course. Existing accounts are reused — one account across courses. */
export async function importRoster(
  actor: User, courseId: string, discipline: Discipline, rows: RosterRow[],
): Promise<{ added: number; alreadyEnrolled: number }> {
  await latency(400);
  if (rows.some((r) => r.problem)) throw new ApiError(400, "Fix the flagged rows before importing.");
  let added = 0;
  let alreadyEnrolled = 0;
  for (const row of rows) {
    let user = db.users.find((u) => u.email.toLowerCase() === row.email.toLowerCase());
    if (!user) {
      user = { id: uid("u"), fullName: row.fullName, email: row.email, universityId: row.universityId, roles: [] };
      db.users.push(user);
    }
    let assignment = user.roles.find((r) => r.role === "student" && r.discipline === discipline);
    if (!assignment) {
      assignment = { role: "student", discipline, courseIds: [] };
      user.roles.push(assignment);
    }
    if (assignment.courseIds.includes(courseId)) {
      alreadyEnrolled++;
    } else {
      assignment.courseIds.push(courseId);
      added++;
    }
  }
  recordAudit(actor, "roster.import", `course/${courseId}`, "ok", `${added} added, ${alreadyEnrolled} already enrolled`);
  return { added, alreadyEnrolled };
}

export async function removeFromCourse(actor: User, courseId: string, userId: string): Promise<void> {
  await latency(200);
  const user = db.users.find((u) => u.id === userId);
  user?.roles.forEach((r) => {
    if (r.role === "student") r.courseIds = r.courseIds.filter((c) => c !== courseId);
  });
  recordAudit(actor, "roster.remove", `course/${courseId}`, "ok", `user/${userId}`);
}
