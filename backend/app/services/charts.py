"""Patient visibility, status changes, and practice-chart reset."""
import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clinical import Allergy, ClinicalNote, LabResult, Medication, Patient, Problem, Vital
from app.models.user import User
from app.services.access import full_name, require, require_course
from app.services.audit import log_event

LIFECYCLE = {"Active", "Inactive", "Prospective", "Discharged from practice", "Archived", "Deceased"}
ENCOUNTER_STATUS = {"Scheduled", "Checked in", "In progress", "Checked out", "Closed"}
CARE_SETTING = {"Outpatient", "Inpatient", "Emergency", "Discharged"}


async def load_patient(db: AsyncSession, patient_id: uuid.UUID) -> Patient:
    patient = await db.get(Patient, patient_id)
    if patient is None or patient.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This patient doesn't exist or was archived.")
    return patient


async def ensure_visible(db: AsyncSession, patient: Patient, user: User, role: str, rows, *, request_ip: str | None) -> None:
    require_course(role, patient.course_id, user, rows)
    if role == "student" and not (patient.mode == "practice" or patient.owner_id == user.id):
        await log_event(
            db,
            action="chart.view",
            entity_type="patient",
            entity_id=str(patient.id),
            actor_user_id=user.id,
            result="denied",
            course_id=patient.course_id,
            ip_address=request_ip,
            detail="Assessment case belongs to another student.",
        )
        await db.commit()
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This case belongs to another student. Each assessment case is private to the student it was assigned to.",
        )
    if role not in {"student", "instructor", "admin", "front_desk"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role can't open charts.")


def owner_name_for(patient: Patient, role: str) -> str | None:
    if role == "student" or patient.owner is None:
        return None
    return full_name(patient.owner)


async def apply_status(db, patient: Patient, user: User, role: str, patch: dict, ip: str | None) -> None:
    provided = {key: value for key, value in patch.items() if value is not None}
    only_encounter = set(provided) <= {"encounter"}
    allowed = can_status(role, only_encounter)
    if not allowed:
        await log_event(
            db,
            action="patient.update_status",
            entity_type="patient",
            entity_id=str(patient.id),
            actor_user_id=user.id,
            result="denied",
            course_id=patient.course_id,
            ip_address=ip,
        )
        await db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only instructors can change this status.")
    if "lifecycle" in provided and provided["lifecycle"] not in LIFECYCLE:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown lifecycle status.")
    if "encounter" in provided and provided["encounter"] not in ENCOUNTER_STATUS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown encounter status.")
    if "care_setting" in provided and provided["care_setting"] not in CARE_SETTING:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown care setting.")
    if "lifecycle" in provided:
        patient.lifecycle = provided["lifecycle"]
    if "encounter" in provided:
        patient.encounter_status = provided["encounter"]
    if "care_setting" in provided:
        patient.care_setting = provided["care_setting"]
    if "program" in provided:
        patient.program = provided["program"]
    await log_event(
        db,
        action="patient.update_status",
        entity_type="patient",
        entity_id=str(patient.id),
        actor_user_id=user.id,
        course_id=patient.course_id,
        ip_address=ip,
        detail=str(provided),
    )


def can_status(role: str, only_encounter: bool) -> bool:
    from app.services.access import can

    return can(role, "patient:update_status") or (only_encounter and can(role, "encounter:advance"))


async def reset_practice(db: AsyncSession, patient: Patient, user: User, role: str, ip: str | None) -> None:
    try:
        require(role, "patient:reset_practice", "Only instructors can reset practice patients.")
    except HTTPException:
        await log_event(
            db,
            action="patient.reset_practice",
            entity_type="patient",
            entity_id=str(patient.id),
            actor_user_id=user.id,
            result="denied",
            course_id=patient.course_id,
            ip_address=ip,
        )
        await db.commit()
        raise
    if patient.mode != "practice" or not patient.snapshot:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only practice patients can be reset.")
    snap = patient.snapshot
    patient.chief_complaint = snap["chief_complaint"]
    patient.hpi = snap["hpi"]
    patient.lifecycle = snap["lifecycle"]
    patient.encounter_status = snap["encounter_status"]
    patient.care_setting = snap["care_setting"]
    patient.program = snap.get("program")
    patient.family_history = snap["family_history"]
    patient.surgical_history = snap["surgical_history"]
    patient.social_history = snap["social_history"]
    await _replace_children(db, patient, snap)
    if patient.encounter and snap.get("encounter"):
        patient.encounter.type = snap["encounter"]["type"]
        patient.encounter.date = date.fromisoformat(snap["encounter"]["date"])
    archived = await db.scalars(
        update(ClinicalNote)
        .where(ClinicalNote.patient_id == patient.id, ClinicalNote.archived.is_(False))
        .values(archived=True)
        .returning(ClinicalNote.id)
    )
    count = len(list(archived.all()))
    db.expire(patient, ["allergies", "medications", "problems", "labs", "vitals", "encounter"])
    await log_event(
        db,
        action="patient.reset_practice",
        entity_type="patient",
        entity_id=str(patient.id),
        actor_user_id=user.id,
        course_id=patient.course_id,
        ip_address=ip,
        detail=f"{count} notes archived",
    )


async def _replace_children(db: AsyncSession, patient: Patient, snap: dict) -> None:
    specs = (
        ("allergies", Allergy, ("substance", "reaction", "severity")),
        ("medications", Medication, ("name", "dose", "route", "frequency", "indication", "adherence")),
        ("problems", Problem, ("code", "description", "since")),
        ("labs", LabResult, ("name", "value", "unit", "reference_range", "flag", "collected_at")),
        ("vitals", Vital, ("label", "value")),
    )
    for key, model, fields in specs:
        getattr(patient, key).clear()
    await db.flush()
    for key, model, fields in specs:
        for item in snap.get(key, []):
            values = {field: item.get(field) for field in fields}
            if isinstance(values.get("collected_at"), str):
                values["collected_at"] = date.fromisoformat(values["collected_at"])
            getattr(patient, key).append(model(**values))


def chart_snapshot(patient: Patient) -> dict:
    """The state an instructor restores a practice chart to."""
    return {
        "chief_complaint": patient.chief_complaint,
        "hpi": patient.hpi,
        "lifecycle": patient.lifecycle,
        "encounter_status": patient.encounter_status,
        "care_setting": patient.care_setting,
        "program": patient.program,
        "family_history": patient.family_history,
        "surgical_history": patient.surgical_history,
        "social_history": patient.social_history,
        "encounter": {
            "type": patient.encounter.type,
            "date": patient.encounter.date.isoformat(),
        }
        if patient.encounter
        else None,
        "allergies": [
            {"id": str(a.id), "substance": a.substance, "reaction": a.reaction, "severity": a.severity}
            for a in patient.allergies
        ],
        "medications": [
            {
                "id": str(m.id),
                "name": m.name,
                "dose": m.dose,
                "route": m.route,
                "frequency": m.frequency,
                "indication": m.indication,
                "adherence": m.adherence,
            }
            for m in patient.medications
        ],
        "problems": [
            {"id": str(p.id), "code": p.code, "description": p.description, "since": p.since} for p in patient.problems
        ],
        "labs": [
            {
                "id": str(lab.id),
                "name": lab.name,
                "value": lab.value,
                "unit": lab.unit,
                "reference_range": lab.reference_range,
                "flag": lab.flag,
                "collected_at": lab.collected_at.isoformat(),
            }
            for lab in patient.labs
        ],
        "vitals": [{"id": str(v.id), "label": v.label, "value": v.value} for v in patient.vitals],
    }


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
