import type { AuditEntry, User } from "../types";
import { clone, latency, uid } from "./client";
import { db } from "./mockDb";

/** Append-only. The real backend enforces this at the database-role level. */
export function recordAudit(
  actor: Pick<User, "id" | "fullName">,
  action: string,
  entity: string,
  result: "ok" | "denied" = "ok",
  detail?: string,
) {
  db.audit.unshift({
    id: uid("a"), timestamp: new Date().toISOString(),
    actorId: actor.id, actorName: actor.fullName, action, entity, result, detail,
  });
}

export async function listAudit(): Promise<AuditEntry[]> {
  await latency();
  return clone(db.audit);
}
