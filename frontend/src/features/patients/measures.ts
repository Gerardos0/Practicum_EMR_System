import type { Patient } from "../../types";

export function latestVital(patient: Patient, label: string): string {
  const rows = patient.vitals.filter(
    (item) => item.status !== "entered_in_error" && item.label.toLowerCase() === label.toLowerCase(),
  );
  rows.sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""));
  return rows[0]?.value.trim() ?? "";
}

function numberIn(value: string): number | undefined {
  const match = value.match(/[\d.]+/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Height in centimeters and weight in kilograms, when the chart records them. */
export function bodyMeasures(patient: Patient): { height: string; weight: string; bmi: string; bsa: string } {
  const height = latestVital(patient, "Height");
  const weight = latestVital(patient, "Weight");
  const cm = height ? numberIn(height) : undefined;
  let kg = weight ? numberIn(weight) : undefined;
  if (kg !== undefined && /lb/i.test(weight)) kg = kg * 0.45359237;
  const meters = cm !== undefined && !/in/i.test(height) ? cm / 100 : undefined;
  const bmi = meters && kg ? kg / (meters * meters) : undefined;
  const bsa = cm && kg && !/in/i.test(height) ? Math.sqrt((cm * kg) / 3600) : undefined;
  return {
    height: height || "Not recorded",
    weight: weight || "Not recorded",
    bmi: bmi ? `${bmi.toFixed(1)} kg/m²` : "Not recorded",
    bsa: bsa ? `${bsa.toFixed(2)} m²` : "Not recorded",
  };
}

export interface PharmacyFacts {
  sex: string;
  heightLine: string;
  weightLine: string;
  bmi: string;
  bsa: string;
  weightKg: string;
  ibw: string;
  scr: string;
  crclActual: string;
  crclIbw: string;
}

/** Height, weight, ideal body weight, and creatinine clearance for the pharmacy profile. */
export function pharmacyFacts(patient: Patient): PharmacyFacts {
  const heightRaw = latestVital(patient, "Height");
  const weightRaw = latestVital(patient, "Weight");
  let cm = heightRaw ? numberIn(heightRaw) : undefined;
  if (cm !== undefined && /in/i.test(heightRaw) && !/cm/i.test(heightRaw)) cm = cm * 2.54;
  let kg = weightRaw ? numberIn(weightRaw) : undefined;
  if (kg !== undefined && /lb/i.test(weightRaw) && !/kg/i.test(weightRaw)) kg = kg * 0.45359237;

  const meters = cm !== undefined ? cm / 100 : undefined;
  const inches = cm !== undefined ? cm / 2.54 : undefined;
  const bmi = meters && kg ? kg / (meters * meters) : undefined;
  const bsa = cm && kg ? Math.sqrt((cm * kg) / 3600) : undefined;
  const ibwKg = inches !== undefined ? idealBodyWeightKg(patient.sexAtBirth, inches) : undefined;
  const scrLab = [...patient.labs]
    .filter((lab) => /creatinine/i.test(lab.name) && !/clearance/i.test(lab.name))
    .sort((a, b) => (b.collectedAt ?? "").localeCompare(a.collectedAt ?? ""))[0];
  const scr = scrLab ? numberIn(scrLab.value) : undefined;
  const clearance = (weight?: number) => {
    if (weight === undefined || scr === undefined || scr <= 0) return "Unable to calculate";
    const sexFactor = patient.sexAtBirth === "Female" ? 0.85 : 1;
    const value = ((140 - patient.ageYears) * weight * sexFactor) / (72 * scr);
    return Number.isFinite(value) ? `${value.toFixed(1)} mL/min` : "Unable to calculate";
  };

  return {
    sex: patient.sexAtBirth === "Male" ? "M" : patient.sexAtBirth === "Female" ? "F" : patient.sexAtBirth,
    heightLine: cm !== undefined ? `${feetAndInches(inches!)} · ${trimNumber(cm)} cm` : "Not recorded",
    weightLine: kg !== undefined ? `${Math.round(kg * 2.2046226218)} lb · ${trimNumber(kg)} kg` : "Not recorded",
    bmi: bmi ? bmi.toFixed(1) : "Not recorded",
    bsa: bsa ? `${bsa.toFixed(2)} m²` : "Not recorded",
    weightKg: kg !== undefined ? `${trimNumber(kg)} kg` : "Not recorded",
    ibw: ibwKg !== undefined ? `${ibwKg.toFixed(1)} kg` : "Not recorded",
    scr: scrLab ? `${scrLab.value} ${scrLab.unit}`.trim() : "No result",
    crclActual: clearance(kg),
    crclIbw: clearance(ibwKg),
  };
}

function idealBodyWeightKg(sex: Patient["sexAtBirth"], inches: number): number {
  const base = sex === "Female" ? 45.5 : 50;
  return base + 2.3 * Math.max(0, inches - 60);
}

function feetAndInches(inches: number): string {
  let feet = Math.floor(inches / 12);
  let inch = Math.round(inches - feet * 12);
  if (inch === 12) {
    feet += 1;
    inch = 0;
  }
  return `${feet} ft ${inch} in`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
