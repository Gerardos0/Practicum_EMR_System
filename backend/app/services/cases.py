"""Authoring for case masters. Copies are separate rows and are never updated here."""

import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clinical import Encounter, Patient
from app.models.user import User
from app.schemas.clinical import CaseIn
from app.services.audit import log_event
from app.services.charts import (
    CARE_SETTING,
    ENCOUNTER_STATUS,
    LIFECYCLE,
    _replace_children,
    load_patient,
    utcnow,
)


async def list_cases(db: AsyncSession, course_id: uuid.UUID) -> list[Patient]:
    rows = await db.scalars(
        select(Patient)
        .where(
            Patient.course_id == course_id,
            Patient.mode == "case",
            Patient.deleted_at.is_(None),
        )
        .order_by(Patient.last_name, Patient.first_name)
    )
    return list(rows.all())


async def load_case(db: AsyncSession, case_id: uuid.UUID) -> Patient:
    patient = await load_patient(db, case_id)
    if patient.mode != "case":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found.")
    return patient


async def create_case(
    db: AsyncSession,
    *,
    body: CaseIn,
    actor: User,
    course_id: uuid.UUID,
    ip: str | None,
) -> Patient:
    _validate(body)
    patient = Patient(
        mrn=await _unique_case_mrn(db),
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        preferred_name=(body.preferred_name or "").strip() or None,
        dob=body.dob,
        sex_at_birth=body.sex_at_birth.strip(),
        pronouns=(body.pronouns or "").strip() or None,
        course_id=course_id,
        mode="case",
        case_key=str(uuid.uuid4()),
        owner_id=None,
        created_by=actor,
        chief_complaint=body.chief_complaint.strip(),
        hpi=body.hpi.strip(),
        past_medical_history=body.past_medical_history.strip(),
        surgical_history=body.surgical_history.strip(),
        family_history=body.family_history.strip(),
        social_history=body.social_history.strip(),
        lifecycle=body.lifecycle,
        encounter_status=body.encounter_status,
        care_setting=body.care_setting,
        program=(body.program or "").strip() or None,
        is_training=True,
        encounter=Encounter(type=body.encounter_type.strip() or "Office visit", date=date.today()),
    )
    db.add(patient)
    await db.flush()
    await db.refresh(patient, attribute_names=["allergies", "medications", "problems", "labs", "vitals", "encounter"])
    await _replace_children(db, patient, _children(body))
    patient.updated_at = utcnow()
    await log_event(
        db,
        action="case.create",
        entity_type="patient",
        entity_id=str(patient.id),
        actor_user_id=actor.id,
        course_id=course_id,
        ip_address=ip,
        detail=f"{patient.last_name}, {patient.first_name} ({patient.mrn})",
    )
    return await _reload(db, patient)


async def update_case(
    db: AsyncSession,
    *,
    patient: Patient,
    body: CaseIn,
    actor: User,
    ip: str | None,
) -> Patient:
    """Replace this master only. Rows with source_patient_id pointing here are left alone."""
    _validate(body)
    await db.refresh(patient, attribute_names=["allergies", "medications", "problems", "labs", "vitals", "encounter"])
    patient.first_name = body.first_name.strip()
    patient.last_name = body.last_name.strip()
    patient.preferred_name = (body.preferred_name or "").strip() or None
    patient.dob = body.dob
    patient.sex_at_birth = body.sex_at_birth.strip()
    patient.pronouns = (body.pronouns or "").strip() or None
    patient.chief_complaint = body.chief_complaint.strip()
    patient.hpi = body.hpi.strip()
    patient.past_medical_history = body.past_medical_history.strip()
    patient.surgical_history = body.surgical_history.strip()
    patient.family_history = body.family_history.strip()
    patient.social_history = body.social_history.strip()
    patient.lifecycle = body.lifecycle
    patient.encounter_status = body.encounter_status
    patient.care_setting = body.care_setting
    patient.program = (body.program or "").strip() or None
    if patient.encounter is None:
        patient.encounter = Encounter(type=body.encounter_type.strip() or "Office visit", date=date.today())
    else:
        patient.encounter.type = body.encounter_type.strip() or "Office visit"
    await _replace_children(db, patient, _children(body))
    patient.updated_at = utcnow()
    await log_event(
        db,
        action="case.update",
        entity_type="patient",
        entity_id=str(patient.id),
        actor_user_id=actor.id,
        course_id=patient.course_id,
        ip_address=ip,
        detail=f"{patient.last_name}, {patient.first_name} ({patient.mrn})",
    )
    return await _reload(db, patient)


def _validate(body: CaseIn) -> None:
    if not body.first_name.strip() or not body.last_name.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "First and last name are required.")
    if not body.sex_at_birth.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Sex at birth is required.")
    if body.lifecycle not in LIFECYCLE:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown lifecycle status.")
    if body.encounter_status not in ENCOUNTER_STATUS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown encounter status.")
    if body.care_setting not in CARE_SETTING:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown care setting.")
    for lab in body.labs:
        if lab.name.strip() and lab.collected_at is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Lab {lab.name} needs a collected date.")


def _children(body: CaseIn) -> dict:
    return {
        "allergies": [
            {"substance": row.substance.strip(), "reaction": _blank(row.reaction), "severity": _blank(row.severity)}
            for row in body.allergies
            if row.substance.strip()
        ],
        "medications": [
            {
                "name": row.name.strip(),
                "dose": row.dose.strip(),
                "route": row.route.strip(),
                "frequency": row.frequency.strip(),
                "indication": _blank(row.indication),
                "adherence": _blank(row.adherence),
            }
            for row in body.medications
            if row.name.strip()
        ],
        "problems": [
            {"code": _blank(row.code), "description": row.description.strip(), "since": _blank(row.since)}
            for row in body.problems
            if row.description.strip()
        ],
        "labs": [
            {
                "name": row.name.strip(),
                "value": row.value.strip(),
                "unit": row.unit.strip(),
                "reference_range": row.reference_range.strip(),
                "flag": _blank(row.flag),
                "collected_at": row.collected_at.isoformat() if row.collected_at else None,
            }
            for row in body.labs
            if row.name.strip()
        ],
        "vitals": [
            {"label": row.label.strip(), "value": row.value.strip()}
            for row in body.vitals
            if row.label.strip()
        ],
    }


def _blank(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None


async def _unique_case_mrn(db: AsyncSession) -> str:
    n = await db.scalar(select(func.count()).select_from(Patient).where(Patient.mrn.like("CASE-%"))) or 0
    for offset in range(50):
        candidate = f"CASE-{10001 + int(n) + offset}"
        exists = await db.scalar(select(Patient.id).where(Patient.mrn == candidate))
        if exists is None:
            return candidate
    raise HTTPException(status.HTTP_409_CONFLICT, "Couldn't allocate a unique MRN. Try again.")


async def _reload(db: AsyncSession, patient: Patient) -> Patient:
    await db.flush()
    await db.refresh(
        patient,
        attribute_names=["owner", "created_by", "allergies", "medications", "problems", "labs", "vitals", "encounter"],
    )
    return patient
