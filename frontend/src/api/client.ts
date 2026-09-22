// Sprint 1: every api/* module runs against the in-memory mockDb.
// Sprint 2: replace function bodies with calls to the FastAPI backend, e.g.
//   const res = await fetch(`${API_BASE}/notes/${id}`, { credentials: "include" });
// Components only import from api/*, so nothing else has to change.

export const API_BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function latency(ms = 200): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
