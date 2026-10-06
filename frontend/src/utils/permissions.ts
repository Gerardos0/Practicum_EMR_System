import type { Role } from "../types";

export type Action =
  | "patient:create"
  | "patient:update_status"
  | "patient:reset_practice"
  | "encounter:advance"
  | "note:author"
  | "note:cosign"
  | "referral:create"
  | "roster:import"
  | "audit:view";

const matrix: Record<Role, Action[]> = {
  student: ["encounter:advance", "note:author", "referral:create"],
  instructor: [
    "patient:create", "patient:update_status", "patient:reset_practice",
    "encounter:advance", "note:cosign", "referral:create", "roster:import", "audit:view",
  ],
  admin: ["patient:create", "patient:update_status", "patient:reset_practice", "roster:import", "audit:view"],
  front_desk: ["patient:create"],
  patient: [],
};

export function can(role: Role, action: Action): boolean {
  return matrix[role].includes(action);
}

export function homePathFor(role: Role): string {
  switch (role) {
    case "student":
    case "instructor":
      return "/dashboard";
    case "admin":
      return "/admin/roster";
    default:
      return "/patients";
  }
}
