import { request } from "./client";

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  await request<void>(`/users/${userId}/active`, { method: "PATCH", json: { isActive } });
}

export async function archiveUser(userId: string): Promise<void> {
  await request<void>(`/users/${userId}/archive`, { method: "POST" });
}

export async function purgeExpiredAccounts(): Promise<{ purged: number }> {
  return request<{ purged: number }>("/users/purge-expired", { method: "POST" });
}

export async function grantPortalAccess(body: { email: string; fullName: string; patientId: string }): Promise<{ temporaryPassword?: string }> {
  return request("/users/portal-access", { method: "POST", json: body });
}