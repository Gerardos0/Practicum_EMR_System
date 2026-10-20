import type {
  Allergy, AuthoredCase, CareSetting, EncounterStatus, LabResult, LifecycleStatus, Medication, Problem, Role, Vital,
} from "../types";
import { request } from "./client";

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
  allergies: Pick<Allergy, "substance" | "reaction" | "severity">[];
  medications: Omit<Medication, "id">[];
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

export interface AnswerDiagnosis {
  rank: number;
  code: string;
  label: string;
  rationale: string;
}

export interface AnswerKey {
  diagnoses: AnswerDiagnosis[];
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
  body: { diagnoses: AnswerDiagnosis[]; planPoints: string[]; rationale: string },
): Promise<AnswerKey> {
  return request<AnswerKey>(`/cases/${caseId}/answer-key`, { method: "PUT", query: { role }, json: body });
}
