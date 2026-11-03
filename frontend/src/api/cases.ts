import type {
  Allergy, AuthoredCase, CareSetting, EncounterStatus, LabResult, LifecycleStatus, Medication, Problem, Role, Vital,
} from "../types";
import { downloadFile, request } from "./client";

export interface CaseInput {
  firstName: string;
  lastName: string;
  preferredName?: string;
  dob: string;
  sexAtBirth: "Male" | "Female";
  pronouns?: string;
  chiefComplaint: string;
  hpi: string;
  pastMedicalHistory: string;
  surgicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  encounterType: string;
  careSetting: CareSetting;
  lifecycle: LifecycleStatus;
  encounterStatus: EncounterStatus;
  program?: string;
  allergies: Pick<Allergy, "substance" | "reaction" | "severity" | "category">[];
  medications: Omit<Medication, "id" | "status" | "discontinuedAt">[];
  sectionLocks?: Record<string, boolean>;
  prefillSections?: string[];
  unit?: string;
  room?: string;
  bed?: string;
  problems: Problem[];
  labs: Omit<LabResult, "id">[];
  vitals: Vital[];
}

export async function listCases(role: Role, courseId: string): Promise<AuthoredCase[]> {
  return request<AuthoredCase[]>("/cases", { query: { course_id: courseId, role } });
}

export async function getCase(role: Role, id: string): Promise<AuthoredCase> {
  return request<AuthoredCase>(`/cases/${id}`, { query: { role } });
}

export async function createCase(role: Role, courseId: string, body: CaseInput): Promise<AuthoredCase> {
  return request<AuthoredCase>("/cases", { method: "POST", query: { course_id: courseId, role }, json: body });
}

export async function updateCase(role: Role, id: string, body: CaseInput): Promise<AuthoredCase> {
  return request<AuthoredCase>(`/cases/${id}`, { method: "PATCH", query: { role }, json: body });
}

export function downloadCaseTemplate(role: Role, courseId: string): Promise<void> {
  return downloadFile("/cases/import-template", "Patient_Case_Upload_Template.xlsx", { course_id: courseId, role });
}

export function importCases(role: Role, courseId: string, file: File): Promise<{ created: number }> {
  const formData = new FormData();
  formData.append("file", file);
  return request<{ created: number }>("/cases/import", { method: "POST", query: { course_id: courseId, role }, formData });
}

export interface AnswerDiagnosis {
  rank: number;
  code: string;
  label: string;
  rationale: string;
}

export interface AnswerKey {
  diagnoses: AnswerDiagnosis[];
  expectedCptCodes: { code: string; label: string }[];
  planPoints: string[];
  rationale: string;
  updatedAt?: string;
}

export async function getAnswerKey(role: Role, caseId: string): Promise<AnswerKey> {
  return request<AnswerKey>(`/cases/${caseId}/answer-key`, { query: { role } });
}

export async function getChartAnswerKey(role: Role, patientId: string): Promise<AnswerKey> {
  return request<AnswerKey>(`/patients/${patientId}/answer-key`, { query: { role } });
}

export async function putAnswerKey(
  role: Role,
  caseId: string,
  body: { diagnoses: AnswerDiagnosis[]; expectedCptCodes: { code: string; label: string }[]; planPoints: string[]; rationale: string },
): Promise<AnswerKey> {
  return request<AnswerKey>(`/cases/${caseId}/answer-key`, { method: "PUT", query: { role }, json: body });
}
