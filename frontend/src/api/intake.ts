import type { Role } from "../types";
import { request } from "./client";

export interface IntakeData {
  preferredName: string;
  pronouns: string;
  phone: string;
  address: string;
  preferredLanguage: string;
  pastMedicalHistory: string;
  surgicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  insurancePayer: string;
  insuranceMemberId: string;
  insuranceGroupNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
}

export interface PortalIntake {
  data: IntakeData;
  identity: { firstName: string; lastName: string; dob: string; sexAtBirth: string; mrn: string };
  source: "chart" | "patient";
  updatedAt?: string | null;
  editable: boolean;
  notEditableReason?: string | null;
}

export interface StaffIntake {
  submitted: boolean;
  data?: IntakeData | null;
  updatedAt?: string | null;
}

export function getPortalIntake(): Promise<PortalIntake> {
  return request<PortalIntake>("/portal/intake", { query: { role: "patient" } });
}

export function savePortalIntake(data: IntakeData): Promise<PortalIntake> {
  return request<PortalIntake>("/portal/intake", { method: "PUT", query: { role: "patient" }, json: data });
}

export function getStaffIntake(patientId: string, role: Role): Promise<StaffIntake> {
  return request<StaffIntake>(`/patients/${patientId}/intake`, { query: { role } });
}
