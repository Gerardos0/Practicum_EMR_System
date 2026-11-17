import type { PatientRow } from "../../api/patients";
import type { Patient } from "../../types";
import { formatDate } from "../../utils/format";

const FINISHED = new Set(["Checked out", "Closed"]);

/** Roomed or in a visit. A filled room also counts once the patient has left the schedule. */
export function isInRoom(patient: Patient): boolean {
  if (patient.mode === "case") return false;
  const encounter = patient.status.encounter;
  if (FINISHED.has(encounter) || encounter === "Scheduled") return false;
  if (encounter === "Roomed" || encounter === "In progress") return true;
  return Boolean(patient.room?.trim());
}

/** Present in the clinic, and not yet assigned to a student or placed in a room. */
export function isWaitingRoom(patient: Patient): boolean {
  if (patient.mode === "case") return false;
  if (patient.ownerId) return false;
  return !isInRoom(patient);
}

export function isAssignedTo(patient: Patient, userId: string): boolean {
  return patient.ownerId === userId;
}

export function placeLabel(patient: Patient): string {
  const parts = [
    patient.unit,
    patient.room?.trim() ? `Room ${patient.room.trim()}` : "",
    patient.bed?.trim() ? `Bed ${patient.bed.trim()}` : "",
  ].filter(Boolean);
  if (parts.length) return parts.join(", ");
  if (patient.status.encounter === "Roomed" || patient.status.encounter === "In progress") return patient.status.encounter;
  return "—";
}

export function matchesPatientQuery(row: PatientRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const p = row.patient;
  const dob = (p.dob || "").slice(0, 10);
  const [year, month, day] = dob.split("-");
  const numericDob = year && month && day ? `${month}/${day}/${year}` : "";
  return [
    p.firstName, p.lastName, p.mrn, p.chiefComplaint, p.room ?? "", p.status.encounter,
    row.ownerName ?? "", dob, numericDob, dob ? formatDate(dob) : "",
  ].some((value) => value.toLowerCase().includes(q));
}

export function byPatientName(a: PatientRow, b: PatientRow): number {
  return `${a.patient.lastName}, ${a.patient.firstName}`.localeCompare(`${b.patient.lastName}, ${b.patient.firstName}`);
}

export function byRoom(a: PatientRow, b: PatientRow): number {
  const room = (a.patient.room ?? "").localeCompare(b.patient.room ?? "", undefined, { numeric: true });
  return room || byPatientName(a, b);
}
