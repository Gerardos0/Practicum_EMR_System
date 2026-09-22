import type { Discipline, NoteTemplateId } from "../../types";

// Discipline-specific structures from the client's sample templates.
// Field ids are the keys stored in ClinicalNote.content (versioned JSONB on the backend).

export type FieldKind = "text" | "textarea" | "icd10" | "medrec";

export interface TemplateField {
  id: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  rows?: number;
}

export interface TemplateSection {
  id: string;
  title: string;
  fields: TemplateField[];
}

export interface NoteTemplate {
  id: NoteTemplateId;
  name: string;
  disciplines: Discipline[] | "all";
  sections: TemplateSection[];
}

const pharmacyMtm: NoteTemplate = {
  id: "pharmacy_mtm",
  name: "Comprehensive medication review (MTM)",
  disciplines: ["pharmacy"],
  sections: [
    {
      id: "S", title: "Subjective",
      fields: [
        { id: "reason", label: "Reason for visit / chief complaint", kind: "textarea", required: true, rows: 2, placeholder: "In the patient's words where possible" },
        { id: "med_experience", label: "Medication experience", kind: "textarea", required: true, rows: 3, placeholder: "How each medication is taken, missed doses, side effects, cost or access problems" },
      ],
    },
    {
      id: "O", title: "Objective",
      fields: [{ id: "objective", label: "Pertinent vitals and labs", kind: "textarea", required: true, rows: 3, placeholder: "Include values that drive your assessment, e.g. A1C, SCr/eGFR, BP" }],
    },
    {
      id: "MR", title: "Medication reconciliation",
      fields: [{ id: "medrec", label: "Reconciled medication list", kind: "medrec" }],
    },
    {
      id: "A", title: "Assessment",
      fields: [
        { id: "dx", label: "Diagnoses (ICD-10)", kind: "icd10", required: true },
        { id: "dtp", label: "Drug therapy problems", kind: "textarea", required: true, rows: 3, placeholder: "Indication, effectiveness, safety, adherence" },
        { id: "rationale", label: "Clinical rationale", kind: "textarea", required: true, rows: 3, placeholder: "What the data supports and why" },
      ],
    },
    {
      id: "P", title: "Plan",
      fields: [
        { id: "recommendations", label: "Pharmacist recommendations", kind: "textarea", required: true, rows: 4, placeholder: "One numbered item per drug therapy problem" },
        { id: "monitoring", label: "Monitoring", kind: "textarea", rows: 2, placeholder: "Parameters, targets, and when to check them" },
        { id: "education", label: "Patient education", kind: "textarea", rows: 2 },
        { id: "followup", label: "Follow-up and referrals", kind: "textarea", required: true, rows: 2 },
      ],
    },
  ],
};

const ptDaily: NoteTemplate = {
  id: "pt_daily_soap",
  name: "PT daily note (SOAP)",
  disciplines: ["physical_therapy"],
  sections: [
    {
      id: "S", title: "Subjective",
      fields: [
        { id: "visit_number", label: "Visit number", kind: "text" },
        { id: "subjective", label: "Patient report", kind: "textarea", required: true, rows: 3, placeholder: "Pain rating, function since last visit, home program adherence" },
      ],
    },
    {
      id: "O", title: "Objective",
      fields: [
        { id: "measures", label: "Measures", kind: "textarea", required: true, rows: 3, placeholder: "ROM, strength (MMT), gait, special tests" },
        { id: "interventions", label: "Interventions performed", kind: "textarea", required: true, rows: 3, placeholder: "Exercise, manual therapy, modalities, with parameters" },
      ],
    },
    {
      id: "A", title: "Assessment",
      fields: [
        { id: "dx", label: "Diagnoses (ICD-10)", kind: "icd10", required: true },
        { id: "progress", label: "Progress toward goals", kind: "textarea", required: true, rows: 3 },
      ],
    },
    {
      id: "P", title: "Plan",
      fields: [
        { id: "plan", label: "Plan", kind: "textarea", required: true, rows: 3, placeholder: "Next visit focus, frequency, home program changes" },
        { id: "goals", label: "Goal status", kind: "textarea", rows: 2, placeholder: "Met / progressing / not met for each goal" },
      ],
    },
  ],
};

const generalSoap: NoteTemplate = {
  id: "general_soap",
  name: "General encounter note (SOAP)",
  disciplines: "all",
  sections: [
    {
      id: "S", title: "Subjective",
      fields: [
        { id: "cc", label: "Chief complaint", kind: "text", required: true },
        { id: "hpi", label: "History of present illness", kind: "textarea", required: true, rows: 4, placeholder: "OLDCARTS: onset, location, duration, character, aggravating/relieving, radiation, timing, severity" },
        { id: "history", label: "PMH, PSH, medications, allergies, FH, SH", kind: "textarea", rows: 3 },
        { id: "ros", label: "Review of systems", kind: "textarea", rows: 3 },
      ],
    },
    {
      id: "O", title: "Objective",
      fields: [{ id: "exam", label: "Vitals and physical exam", kind: "textarea", required: true, rows: 4, placeholder: "By system" }],
    },
    {
      id: "A", title: "Assessment",
      fields: [
        { id: "dx", label: "Problem list (ICD-10)", kind: "icd10", required: true },
        { id: "rationale", label: "Clinical rationale", kind: "textarea", required: true, rows: 3 },
      ],
    },
    {
      id: "P", title: "Plan",
      fields: [
        { id: "plan", label: "Plan by problem", kind: "textarea", required: true, rows: 4 },
        { id: "disposition", label: "Disposition", kind: "textarea", rows: 2 },
      ],
    },
  ],
};

export const TEMPLATES: Record<NoteTemplateId, NoteTemplate> = {
  pharmacy_mtm: pharmacyMtm,
  pt_daily_soap: ptDaily,
  general_soap: generalSoap,
};

export function templatesFor(discipline?: Discipline): NoteTemplate[] {
  return Object.values(TEMPLATES).filter(
    (t) => t.disciplines === "all" || (discipline && t.disciplines.includes(discipline)),
  );
}

export function defaultTemplateFor(discipline?: Discipline): NoteTemplateId {
  if (discipline === "pharmacy") return "pharmacy_mtm";
  if (discipline === "physical_therapy") return "pt_daily_soap";
  return "general_soap";
}

/** Returns the labels of required fields that are still empty. */
export function missingRequired(
  templateId: NoteTemplateId, content: Record<string, string>, diagnosisCount: number,
): string[] {
  return TEMPLATES[templateId].sections
    .flatMap((s) => s.fields)
    .filter((f) => f.required)
    .filter((f) => (f.kind === "icd10" ? diagnosisCount === 0 : !(content[f.id] ?? "").trim()))
    .map((f) => f.id);
}
