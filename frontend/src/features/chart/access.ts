import type { Patient, Role } from "../../types";
import { can } from "../../utils/permissions";

const DEFAULT_LOCKS: Record<string, boolean> = {
  medications: false,
  allergies: false,
  vitals: false,
  labs: false,
  diagnoses: true,
  medical_history: true,
  surgical_history: true,
  chief_complaint: true,
};

export function sectionLocked(patient: Patient, section: string): boolean {
  return (patient.sectionLocks ?? DEFAULT_LOCKS)[section] ?? true;
}

/** Shared practice charts are open to the class. Every other chart belongs to its assigned student. */
export function canChartPatient(role: Role, patient: Patient, userId: string): boolean {
  if (role === "admin") return false;
  if (role !== "student") return true;
  if (patient.mode === "practice" && !patient.ownerId) return true;
  return patient.ownerId === userId;
}

export function canEditSection(role: Role, patient: Patient, section: string, userId: string): boolean {
  if (!canChartPatient(role, patient, userId)) return false;
  if (can(role, "case:author") || can(role, "patient:update_status")) return true;
  return role === "student" && !sectionLocked(patient, section);
}
