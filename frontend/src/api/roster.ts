import type { Discipline, RosterRow, User } from "../types";
import { request } from "./client";

export interface TempPassword {
  email: string;
  password: string;
}

export interface RosterImportResult {
  added: number;
  alreadyEnrolled: number;
  temporaryPasswords: TempPassword[];
}

export async function listRoster(courseId: string): Promise<User[]> {
  return request<User[]>(`/courses/${courseId}/roster`);
}

export async function importRoster(courseId: string, discipline: Discipline, rows: RosterRow[]): Promise<RosterImportResult> {
  return request<RosterImportResult>(`/courses/${courseId}/roster/import`, {
    method: "POST",
    json: { discipline, rows },
  });
}

export async function removeFromCourse(courseId: string, userId: string): Promise<void> {
  await request<void>(`/courses/${courseId}/roster/${userId}`, { method: "DELETE" });
}
