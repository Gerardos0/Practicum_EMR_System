import type { Course, CourseStatus, User } from "../types";
import { ApiError, downloadFile, request } from "./client";

export async function listCoursesForUser(): Promise<Course[]> {
  return request<Course[]>("/courses");
}

export async function getCourse(id: string): Promise<Course | undefined> {
  try {
    return await request<Course>(`/courses/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

export async function listInstructors(courseId: string): Promise<User[]> {
  return request<User[]>(`/courses/${courseId}/instructors`);
}

export async function createCourse(input: Pick<Course, "code" | "title" | "term">): Promise<Course> {
  return request<Course>("/courses", { method: "POST", json: input });
}

export async function setCourseStatus(courseId: string, status: CourseStatus): Promise<Course> {
  return request<Course>(`/courses/${courseId}/status`, { method: "POST", json: { status } });
}

export async function uploadGradingGuide(courseId: string, file: File): Promise<Course> {
  const formData = new FormData();
  formData.append("file", file);
  return request<Course>(`/courses/${courseId}/grading-guide`, { method: "POST", formData });
}

export function downloadGrades(courseId: string, role: string, caseKey: string): Promise<void> {
  return downloadFile(`/reports/courses/${courseId}/grades.xlsx`, "case-grades.xlsx", { role, case_key: caseKey });
}

export function downloadChartTime(courseId: string, role: string): Promise<void> {
  return downloadFile(`/reports/courses/${courseId}/activity.xlsx`, "chart-time.xlsx", { role });
}
