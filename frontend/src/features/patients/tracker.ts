import type { PatientRow } from "../../api/patients";
import type { Patient } from "../../types";
import { formatDate } from "../../utils/format";

const FINISHED = new Set(["Checked out", "Closed"]);

/** Visit status is Checked in. A room number alone does not count until the visit is roomed. */
export function isCheckedIn(patient: Patient): boolean {
  if (patient.mode === "case") return false;
  return patient.status.encounter === "Checked in";
}

/** Roomed or in a visit. */
export function isInRoom(patient: Patient): boolean {
  if (patient.mode === "case") return false;
  const encounter = patient.status.encounter;
  return encounter === "Roomed" || encounter === "In progress";
}

/** Not checked in and not in a room yet. */
export function isWaitingRoom(patient: Patient): boolean {
  if (patient.mode === "case") return false;
  if (isCheckedIn(patient) || isInRoom(patient)) return false;
  return !FINISHED.has(patient.status.encounter);
}

/** A flagged lab on the chart. */
export function hasAbnormalResults(patient: Patient): boolean {
  return patient.labs.some((lab) => Boolean(lab.flag));
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
  return "";
}

/** Current visit status, with the bed assignment when one is set. */
export function visitLine(patient: Patient): string {
  const place = placeLabel(patient);
  return place ? `${patient.status.encounter} · ${place}` : patient.status.encounter;
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
