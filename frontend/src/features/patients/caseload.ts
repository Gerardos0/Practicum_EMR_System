import type { PatientRow } from "../../api/patients";
import type { EncounterStatus } from "../../types";

const IN_CLINIC = new Set<EncounterStatus>(["In progress", "Checked in", "Roomed"]);

export const CASELOAD_VIEWS = [
  {
    id: "assigned",
    label: "Assigned patients",
    short: "Assigned",
    emptyTitle: "No assigned patients yet",
    emptyBody: "Your instructor will assign cases here.",
  },
  {
    id: "in-clinic",
    label: "In clinic now",
    short: "In clinic",
    emptyTitle: "No one is in clinic right now",
    emptyBody: "Checked-in, roomed, and in-progress visits show up here.",
  },
  {
    id: "returned",
    label: "Returned notes",
    short: "Returned",
    emptyTitle: "No returned notes",
    emptyBody: "When an instructor returns a note, that patient shows up here.",
  },
  {
    id: "awaiting",
    label: "Awaiting review",
    short: "Awaiting",
    emptyTitle: "No notes awaiting review",
    emptyBody: "Submitted notes waiting for an instructor appear here.",
  },
  {
    id: "practice",
    label: "Practice cases",
    short: "Practice",
    emptyTitle: "No practice cases",
    emptyBody: "Practice patients for this course will show up here.",
  },
] as const;

export type CaseloadView = (typeof CASELOAD_VIEWS)[number]["id"];

export function parseCaseloadView(value: string | null): CaseloadView | undefined {
  return CASELOAD_VIEWS.find((view) => view.id === value)?.id;
}

export function caseloadViewMeta(view: CaseloadView) {
  return CASELOAD_VIEWS.find((item) => item.id === view)!;
}

export function caseloadHref(view: CaseloadView, query = "") {
  const params = new URLSearchParams({ view });
  if (query) params.set("q", query);
  return `/patients?${params.toString()}`;
}

export function matchesCaseload(row: PatientRow, view: CaseloadView, userId?: string): boolean {
  if (row.patient.mode === "case") return false;
  switch (view) {
    case "assigned":
      return row.patient.mode === "assessment" && (!userId || row.patient.ownerId === userId);
    case "practice":
      return row.patient.mode === "practice";
    case "in-clinic":
      return IN_CLINIC.has(row.patient.status.encounter)
        && (!userId || row.patient.mode === "practice" || row.patient.ownerId === userId);
    case "returned":
      return row.latestNote?.status === "returned";
    case "awaiting":
      return row.latestNote?.status === "pending_review";
  }
}
