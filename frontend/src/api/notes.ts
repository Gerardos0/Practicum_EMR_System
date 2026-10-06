import type { ClinicalNote, Discipline, IcdCode, NoteTemplateId, Patient, Role } from "../types";
import { request } from "./client";

export async function listNotesForPatient(role: Role, patientId: string): Promise<ClinicalNote[]> {
  return request<ClinicalNote[]>(`/patients/${patientId}/notes`, { query: { role } });
}

export async function getNote(role: Role, id: string): Promise<ClinicalNote> {
  return request<ClinicalNote>(`/notes/${id}`, { query: { role } });
}

export async function createDraft(
  discipline: Discipline, patient: Patient, templateId: NoteTemplateId, role: Role,
): Promise<ClinicalNote> {
  return request<ClinicalNote>(`/patients/${patient.id}/notes`, {
    method: "POST",
    query: { role },
    json: { templateId, discipline },
  });
}

export interface DraftPatch {
  templateId?: NoteTemplateId;
  content?: Record<string, string>;
  diagnoses?: IcdCode[];
  routedToId?: string;
}

export async function saveDraft(id: string, expectedVersion: number, patch: DraftPatch, role: Role): Promise<ClinicalNote> {
  return request<ClinicalNote>(`/notes/${id}`, {
    method: "PATCH",
    query: { role },
    json: { expectedVersion, ...patch },
  });
}

export async function signNote(id: string, expectedVersion: number, role: Role): Promise<ClinicalNote> {
  return request<ClinicalNote>(`/notes/${id}/sign`, {
    method: "POST",
    query: { role },
    json: { expectedVersion },
  });
}

export async function cosignNote(role: Role, id: string, comment?: string): Promise<ClinicalNote> {
  return request<ClinicalNote>(`/notes/${id}/cosign`, {
    method: "POST",
    query: { role },
    json: { comment: comment ?? "" },
  });
}

export async function returnNote(role: Role, id: string, comment: string): Promise<ClinicalNote> {
  return request<ClinicalNote>(`/notes/${id}/return`, {
    method: "POST",
    query: { role },
    json: { comment },
  });
}

export async function addAddendum(id: string, body: string, role: Role): Promise<ClinicalNote> {
  return request<ClinicalNote>(`/notes/${id}/addenda`, {
    method: "POST",
    query: { role },
    json: { body },
  });
}

export interface QueueItem {
  note: ClinicalNote;
  patient: Patient;
}

export async function listReviewQueue(courseId: string, role: Role): Promise<QueueItem[]> {
  return request<QueueItem[]>("/review-queue", { query: { course_id: courseId, role } });
}
