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

export function canEditSection(role: Role, patient: Patient, section: string): boolean {
  if (patient.mode === "simulation" && section === "vitals") {
    return patient.viewerStation === "nurse" && patient.simulationPhase !== "closed";
  }
  if (can(role, "case:author") || can(role, "patient:update_status")) return true;
  return role === "student" && !sectionLocked(patient, section);
}
