import type { Course, User } from "../types";
import { ApiError, request } from "./client";

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
