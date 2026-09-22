import type { Role } from "../types";

// One place to answer "is this role allowed to do X?" in the UI.
// The backend must enforce the same rules — hiding a button is not security.
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
    case "instructor":
      return "/review";
    case "admin":
      return "/admin/roster";
    default:
      return "/patients";
  }
}
