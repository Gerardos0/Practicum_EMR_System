"""Prefill new notes from the chart (DOC-02)."""

from __future__ import annotations

from typing import Any

from app.models.patient import Patient


def _vitals_block(patient: Patient) -> str:
    vitals = patient.vitals or []
    if not vitals:
        return ""
    return "; ".join(f"{v.get('label')}: {v.get('value')}" for v in vitals if isinstance(v, dict))


def _labs_block(patient: Patient) -> str:
    labs = patient.labs or []
    if not labs:
        return ""
    parts: list[str] = []
    for lab in labs:
        if not isinstance(lab, dict):
            continue
        flag = lab.get("flag")
        parts.append(
            f"{lab.get('name')} {lab.get('value')} {lab.get('unit')}"
            + (f" ({flag})" if flag else "")
        )
    return "; ".join(parts)


def _history_block(patient: Patient) -> str:
    allergies = patient.allergies or []
    if allergies:
        allergy = "; ".join(
            f"{a.get('substance')}"
            + (f" ({a.get('reaction')})" if isinstance(a, dict) and a.get("reaction") else "")
            for a in allergies
            if isinstance(a, dict)
        )
    else:
        allergy = "NKDA"

    meds = patient.medications or []
    med_text = "; ".join(
        f"{m.get('name')} {m.get('dose')} {m.get('route')} {m.get('frequency')}"
        for m in meds
        if isinstance(m, dict)
    ) or "None listed"

    problems = patient.problems or []
    pmh = "; ".join(
        p.get("description", "") for p in problems if isinstance(p, dict) and p.get("description")
    ) or "None listed"

    return "\n".join(
        [
            f"PMH: {pmh}",
            f"PSH: {patient.surgical_history or ''}",
            f"Medications: {med_text}",
            f"Allergies: {allergy}",
            f"FH: {patient.family_history or ''}",
            f"SH: {patient.social_history or ''}",
        ]
    )


# Field ids that exist on each template (keep in sync with frontend noteTemplates.ts).
_TEMPLATE_FIELDS: dict[str, set[str]] = {
    "pharmacy_mtm": {
        "reason", "med_experience", "objective", "medrec", "dx", "dtp", "rationale",
        "recommendations", "monitoring", "education", "followup",
    },
    "pt_daily_soap": {
        "visit_number", "subjective", "measures", "interventions", "dx", "assessment",
        "plan", "goals",
    },
    "general_soap": {
        "cc", "hpi", "history", "ros", "exam", "dx", "rationale", "plan", "disposition",
    },
}


def prefill_from_patient(template_id: str, patient: Patient) -> dict[str, Any]:
    fields = _TEMPLATE_FIELDS.get(template_id, set())
    vitals = _vitals_block(patient)
    labs = _labs_block(patient)
    objective = ". ".join(p for p in (vitals, labs) if p)
    draft: dict[str, str] = {}

    def put(field_id: str, value: str) -> None:
        if field_id in fields and value.strip():
            draft[field_id] = value.strip()

    put("reason", patient.chief_complaint or "")
    put("cc", patient.chief_complaint or "")
    put("hpi", patient.hpi or "")
    put("subjective", patient.chief_complaint or "")
    put("objective", objective)
    put("exam", f"{objective}\n\nPhysical exam: (document findings)" if objective else "")
    put("history", _history_block(patient))
    put("measures", vitals)
    return draft
