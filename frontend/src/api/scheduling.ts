import type { Appointment, Referral, Role } from "../types";
import { request } from "./client";

export async function listAppointments(patientId: string, role: Role): Promise<Appointment[]> {
  return request<Appointment[]>(`/patients/${patientId}/appointments`, { query: { role } });
}

export async function listReferrals(patientId: string, role: Role): Promise<Referral[]> {
  return request<Referral[]>(`/patients/${patientId}/referrals`, { query: { role } });
}

export async function createReferral(
  role: Role,
  input: Omit<Referral, "id" | "createdByName" | "createdAt">,
): Promise<Referral> {
  return request<Referral>(`/patients/${input.patientId}/referrals`, {
    method: "POST",
    query: { role },
    json: { toDiscipline: input.toDiscipline, reason: input.reason, urgency: input.urgency },
  });
}
