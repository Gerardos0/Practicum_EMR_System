import type { AuditEntry, Role } from "../types";
import { request } from "./client";

export async function listAudit(courseId: string | undefined, role: Role, patientId?: string): Promise<AuditEntry[]> {
  return request<AuditEntry[]>("/audit", { query: { course_id: courseId, role, patient_id: patientId } });
}
