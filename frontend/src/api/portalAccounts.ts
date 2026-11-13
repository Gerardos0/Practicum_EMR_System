import { ApiError, request } from "./client";
import { login, type LoginResult } from "./auth";
import type { User } from "../types";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  mustChangePassword: boolean;
  user: User;
}

export async function patientLogin(username: string, password: string): Promise<LoginResult> {
  try {
    return await login(username, password);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(401, "That username and password don't match.");
    }
    throw error;
  }
}

export async function patientSignup(body: { code: string; username: string; password: string }): Promise<LoginResult> {
  const result = await request<TokenResponse>("/auth/patient-signup", {
    method: "POST",
    json: body,
    auth: false,
  });
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    mustChangePassword: result.mustChangePassword,
    user: result.user,
  };
}

export async function createPortalInvite(patientId: string): Promise<{ code: string; expiresAt: string }> {
  return request<{ code: string; expiresAt: string }>(`/patients/${patientId}/portal-invite`, { method: "POST" });
}

export interface ProvisionRequest {
  dryRun: boolean;
  modes?: Array<"practice" | "assessment">;
  courseCode?: string;
  limit?: number;
}

export interface ProvisionPreview {
  eligible: number;
  created: number;
  skippedClaimed: number;
  skippedCaseMasters: number;
  skippedInactiveCourse: number;
  remaining: number;
  rows: Array<{ username: string; patientName: string; mrn: string; courseCode: string; mode: string }>;
}

export async function provisionPatientLogins(body: ProvisionRequest): Promise<ProvisionPreview | void> {
  if (body.dryRun) {
    return request<ProvisionPreview>("/users/portal-logins/provision", { method: "POST", json: body });
  }
  const blob = await request<Blob>("/users/portal-logins/provision", {
    method: "POST",
    json: body,
    responseType: "blob",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "patient-logins.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
