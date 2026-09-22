// In-memory mock data. Nothing here persists across a page refresh —
// this is a Sprint 1 UI prototype, not a connected backend.
// Sprint 2 replaces this file's exports with real API calls.

export type Role = "student" | "instructor";

export interface CurrentUser {
  id: string;
  fullName: string;
  role: Role;
  discipline: string;
}

export const currentUser: CurrentUser = {
  id: "u_reyes",
  fullName: "Daniel Reyes",
  role: "student",
  discipline: "Pharmacy Student",
};

export interface Patient {
  id: string;
  mrn: string;
  lastName: string;
  firstName: string;
  dob: string;
  sex: "M" | "F";
  ageYears: number;
  allergy: string | null;
  encounterStatus: "Checked in" | "Scheduled";
  mode: "Graded assignment" | "Practice";
  chiefComplaint: string;
  medications: string[];
  problems: string[];
  labs: { name: string; value: string; flag?: "H" | "L" }[];
  vitals: { label: string; value: string }[];
}

export const patients: Patient[] = [
  {
    id: "p_einstein",
    mrn: "100241",
    lastName: "Einstein",
    firstName: "Albert",
    dob: "1969-03-14",
    sex: "M",
    ageYears: 57,
    allergy: "Penicillin",
    encounterStatus: "Checked in",
    mode: "Graded assignment",
    chiefComplaint:
      "Routine follow-up for diabetes. Reports increased thirst and fatigue over the past two months. Takes metformin most days but skips doses when away from home.",
    medications: ["Metformin 500 mg — PO daily", "Multivitamin — PO daily"],
    problems: ["Type 2 diabetes mellitus — dx 2016", "Family history of diabetes"],
    labs: [
      { name: "Hemoglobin A1C", value: "10.5 %", flag: "H" },
      { name: "Creatinine", value: "0.9 mg/dL" },
      { name: "Potassium", value: "4.1 mmol/L" },
    ],
    vitals: [
      { label: "BP", value: "138 / 84 mmHg" },
      { label: "Pulse", value: "78 bpm" },
      { label: "Weight", value: "91.2 kg" },
    ],
  },
  {
    id: "p_delgado",
    mrn: "100242",
    lastName: "Delgado",
    firstName: "Maria",
    dob: "1982-07-02",
    sex: "F",
    ageYears: 44,
    allergy: null,
    encounterStatus: "Scheduled",
    mode: "Practice",
    chiefComplaint: "Annual wellness visit, no acute complaints.",
    medications: ["Levothyroxine 50 mcg — PO daily"],
    problems: ["Hypothyroidism — dx 2019"],
    labs: [{ name: "TSH", value: "2.1 mIU/L" }],
    vitals: [
      { label: "BP", value: "118 / 76 mmHg" },
      { label: "Pulse", value: "70 bpm" },
      { label: "Weight", value: "63.4 kg" },
    ],
  },
  {
    id: "p_okafor",
    mrn: "100243",
    lastName: "Okafor",
    firstName: "Raymond",
    dob: "1955-11-19",
    sex: "M",
    ageYears: 70,
    allergy: null,
    encounterStatus: "Scheduled",
    mode: "Practice",
    chiefComplaint: "Follow-up for hypertension management.",
    medications: ["Lisinopril 10 mg — PO daily"],
    problems: ["Essential hypertension — dx 2011"],
    labs: [{ name: "Sodium", value: "140 mmol/L" }],
    vitals: [
      { label: "BP", value: "146 / 90 mmHg" },
      { label: "Pulse", value: "82 bpm" },
      { label: "Weight", value: "84.0 kg" },
    ],
  },
];

export type NoteStatus = "draft" | "pending_review" | "cosigned";

export interface ClinicalNote {
  id: string;
  patientId: string;
  authorName: string;
  authorDiscipline: string;
  submittedAt: string | null;
  status: NoteStatus;
  icd10: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

// Mutable in-memory list so a submit made in NoteForm shows up in
// InstructorQueue during the same browser session. Resets on refresh.
export const submittedNotes: ClinicalNote[] = [
  {
    id: "n_sillas",
    patientId: "p_delgado",
    authorName: "Sillas, Gerardo",
    authorDiscipline: "Pharmacy Student",
    submittedAt: "2026-09-22 15:10",
    status: "cosigned",
    icd10: "E03.9 — Hypothyroidism, unspecified",
    subjective: "Patient reports good adherence to levothyroxine.",
    objective: "TSH within normal limits.",
    assessment: "Well-controlled hypothyroidism.",
    plan: "Continue current dose. Repeat TSH in 6 months.",
  },
];

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  result: string;
  denied?: boolean;
}

export const auditLog: AuditEvent[] = [
  {
    id: "a4",
    timestamp: "16:48:12",
    actor: "reyes.d (student)",
    action: "note.cosign",
    entity: "clinical_note/8814",
    result: "403 — role denied",
    denied: true,
  },
  {
    id: "a3",
    timestamp: "16:41:57",
    actor: "reyes.d (student)",
    action: "patient.view",
    entity: "patient/100241",
    result: "200",
  },
];
