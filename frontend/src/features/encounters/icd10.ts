import type { IcdCode } from "../../types";

// Demo subset. Sprint 2: search the ICD-10 reference table on the backend.
export const ICD10: IcdCode[] = [
  { code: "E11.65", label: "Type 2 diabetes mellitus with hyperglycemia" },
  { code: "E11.9", label: "Type 2 diabetes mellitus without complications" },
  { code: "Z79.84", label: "Long term (current) use of oral hypoglycemic drugs" },
  { code: "Z91.14", label: "Patient's other noncompliance with medication regimen" },
  { code: "Z71.3", label: "Dietary counseling and surveillance" },
  { code: "E66.9", label: "Obesity, unspecified" },
  { code: "E78.5", label: "Hyperlipidemia, unspecified" },
  { code: "I10", label: "Essential (primary) hypertension" },
  { code: "Z88.0", label: "Allergy status to penicillin" },
  { code: "E55.9", label: "Vitamin D deficiency, unspecified" },
  { code: "J45.909", label: "Unspecified asthma, uncomplicated" },
  { code: "M54.50", label: "Low back pain, unspecified" },
  { code: "M17.11", label: "Unilateral primary osteoarthritis, right knee" },
  { code: "M62.81", label: "Muscle weakness (generalized)" },
  { code: "R26.89", label: "Other abnormalities of gait and mobility" },
  { code: "R13.10", label: "Dysphagia, unspecified" },
];
