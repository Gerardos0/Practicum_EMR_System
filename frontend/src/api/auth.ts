import type { User } from "../types";
import { ApiError, request } from "./client";

export interface LoginResult {
  accessToken: string;
  mustChangePassword: boolean;
  user: User;
}

interface TokenResponse {
  access_token: string;
  mustChangePassword: boolean;
  user: User;
}

const ALLOWED = /@(miners\.)?utep\.edu$/i;

export async function login(email: string, password: string): Promise<LoginResult> {
  const trimmed = email.trim();
  if (!ALLOWED.test(trimmed)) {
    throw new ApiError(400, "Use your UTEP email address (@utep.edu or @miners.utep.edu).");
  }
  const form = new URLSearchParams();
  form.set("username", trimmed);
  form.set("password", password);
  try {
    const body = await request<TokenResponse>("/auth/login", { method: "POST", form, auth: false });
    return {
      accessToken: body.access_token,
      mustChangePassword: body.mustChangePassword,
      user: body.user,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(401, "That email and password don't match an EMR account. Ask your instructor to confirm you're on the course roster.");
    }
    throw error;
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request<void>("/auth/change-password", {
    method: "POST",
    json: { currentPassword, newPassword },
  });
}
