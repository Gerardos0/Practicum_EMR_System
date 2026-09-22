import type { Course, User } from "../types";
import { clone, latency } from "./client";
import { db } from "./mockDb";

export async function listCoursesForUser(user: User): Promise<Course[]> {
  await latency(150);
  const ids = new Set(user.roles.flatMap((r) => r.courseIds));
  return clone(db.courses.filter((c) => ids.has(c.id)));
}

export async function getCourse(id: string): Promise<Course | undefined> {
  await latency(100);
  return clone(db.courses.find((c) => c.id === id));
}

export async function listInstructors(courseId: string): Promise<User[]> {
  await latency(100);
  const course = db.courses.find((c) => c.id === courseId);
  return clone(db.users.filter((u) => course?.instructorIds.includes(u.id)));
}
