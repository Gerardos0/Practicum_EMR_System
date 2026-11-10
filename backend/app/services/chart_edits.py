"""Student chart updates, simulated bed assignment, and medication administration."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clinical_sections import ALLERGY_CATEGORIES, locks_or_default
from app.models.clinical import Allergy, ChartSession, LabResult, Medication, MedicationAdministration, Patient, Problem, Vital
from app.models.user import User
from app.services.access import can, full_name
from app.services.audit import log_event
from app.services.charts import utcnow
from app.services.dose_check import check_dose
from app.services.guardrails import guardrail_mode


def _locked(patient: Patient, section: str) -> bool:
    return bool(locks_or_default(patient.section_locks).get(section, True))


def _can_edit_section(role: str, patient: Patient, section: str) -> bool:
    if can(role, "case:author") or can(role, "patient:update_status"):
        return True
    if role == "student" and not _locked(patient, section):
        return True
    return False


def _deny(section: str) -> None:
    raise HTTPException(status.HTTP_403_FORBIDDEN, f"This case locks the {section.replace('_', ' ')} section.")


async def add_allergy(db, patient: Patient, actor: User, role: str, body: dict, ip: str | None) -> None:
    if not _can_edit_section(role, patient, "allergies"):
        _deny("allergies")
    category = body.get("category") or "medication"
    if category not in ALLERGY_CATEGORIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Allergy category must be medication, food, or environmental.")
    substance = (body.get("substance") or "").strip()
    if not substance:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Name the allergen.")
    patient.allergies.append(
        Allergy(
            substance=substance,
            reaction=(body.get("reaction") or "").strip() or None,
            severity=(body.get("severity") or "").strip() or None,
            category=category,
        )
    )
    await _touch(db, patient, actor, ip, "allergy.add", substance)


async def update_allergy(db, patient: Patient, actor: User, role: str, allergy_id: uuid.UUID, body: dict, ip: str | None) -> None:
    if not _can_edit_section(role, patient, "allergies"):
        _deny("allergies")
    row = _find(patient.allergies, allergy_id, "Allergy")
    if "substance" in body:
        row.substance = (body.get("substance") or "").strip() or row.substance
    if "reaction" in body:
        row.reaction = (body.get("reaction") or "").strip() or None
    if "severity" in body:
        row.severity = (body.get("severity") or "").strip() or None
    if body.get("category") in ALLERGY_CATEGORIES:
        row.category = body["category"]
    await _touch(db, patient, actor, ip, "allergy.update", row.substance)


async def delete_allergy(db, patient: Patient, actor: User, role: str, allergy_id: uuid.UUID, ip: str | None) -> None:
    if not _can_edit_section(role, patient, "allergies"):
        _deny("allergies")
    row = _find(patient.allergies, allergy_id, "Allergy")
    name = row.substance
    patient.allergies.remove(row)
    await db.delete(row)
    await _touch(db, patient, actor, ip, "allergy.delete", name)


def _names(body: dict, fallback: str = "") -> tuple[str, str | None, list[str]]:
    generic = (body.get("generic_name") or "").strip() or None
    brands = [str(item).strip() for item in (body.get("brand_names") or []) if str(item).strip()]
    rxcui = (body.get("rxcui") or "").strip() or None
    return generic or fallback, rxcui, brands


async def _dose_flags(db, patient: Patient, role: str, dose: str, drug_name: str, body: dict) -> list[dict]:
    if body.get("clear_flags") and can(role, "note:cosign"):
        await log_event(
            db,
            action="medication.flag_cleared",
            entity_type="patient",
            entity_id=str(patient.id),
            actor_user_id=body.get("_actor_id"),
            course_id=patient.course_id,
            detail=drug_name,
        )
        return []
    mode = await guardrail_mode(db, patient.course_id)
    flags = [] if mode == "off" else check_dose(dose, drug_name)
    if role == "student" and flags:
        acknowledged = set(body.get("acknowledged_flags") or [])
        if mode == "block":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, flags[0]["message"])
        if mode == "acknowledge" and any(flag["code"] not in acknowledged for flag in flags):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Confirm the dose warning before saving.")
    return flags


async def add_medication(db, patient: Patient, actor: User, role: str, body: dict, ip: str | None) -> None:
    if not _can_edit_section(role, patient, "medications"):
        _deny("medications")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Name the medication.")
    generic, rxcui, brands = _names(body, name)
    dose = (body.get("dose") or "").strip()
    flags = await _dose_flags(db, patient, role, dose, generic or name, {**body, "_actor_id": actor.id})
    patient.medications.append(
        Medication(
            name=name,
            dose=dose,
            route=(body.get("route") or "").strip(),
            frequency=(body.get("frequency") or "").strip(),
            indication=(body.get("indication") or "").strip() or None,
            adherence=(body.get("adherence") or "").strip() or None,
            access_cost=(body.get("access_cost") or "").strip() or None,
            prescribed=bool(body.get("prescribed")),
            status="active",
            rxcui=rxcui,
            generic_name=generic if generic != name else (body.get("generic_name") or "").strip() or None,
            brand_names=brands,
            flags=flags,
        )
    )
    await _touch(db, patient, actor, ip, "medication.add", name)


async def update_medication(db, patient: Patient, actor: User, role: str, medication_id: uuid.UUID, body: dict, ip: str | None) -> None:
    if not _can_edit_section(role, patient, "medications"):
        _deny("medications")
    row = _find(patient.medications, medication_id, "Medication")
    if row.status == "entered_in_error":
        raise HTTPException(status.HTTP_409_CONFLICT, "That medication was removed as a mistake.")
    for field in ("name", "dose", "route", "frequency", "indication", "adherence", "access_cost"):
        if field in body:
            value = (body.get(field) or "").strip()
            setattr(row, field, value or None if field in {"indication", "adherence", "access_cost"} else value)
    if "prescribed" in body:
        row.prescribed = bool(body["prescribed"])
    if "rxcui" in body:
        row.rxcui = (body.get("rxcui") or "").strip() or None
    if "generic_name" in body:
        row.generic_name = (body.get("generic_name") or "").strip() or None
    if isinstance(body.get("brand_names"), list):
        row.brand_names = [str(item).strip() for item in body["brand_names"] if str(item).strip()]
    drug = row.generic_name or row.name
    row.flags = await _dose_flags(db, patient, role, row.dose or "", drug, {**body, "_actor_id": actor.id})
    await _touch(db, patient, actor, ip, "medication.update", row.name)


async def discontinue_medication(db, patient: Patient, actor: User, role: str, medication_id: uuid.UUID, ip: str | None) -> None:
    if not _can_edit_section(role, patient, "medications"):
        _deny("medications")
    row = _find(patient.medications, medication_id, "Medication")
    if row.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only an active medication can be discontinued.")
    row.status = "discontinued"
    row.discontinued_at = utcnow()
    await _touch(db, patient, actor, ip, "medication.discontinue", row.name)


async def delete_medication(db, patient: Patient, actor: User, role: str, medication_id: uuid.UUID, reason: str | None, ip: str | None) -> None:
    if not _can_edit_section(role, patient, "medications"):
        _deny("medications")
    if reason != "entered_in_error":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Discontinued medications stay on the chart. Delete is only for a medication entered by mistake.",
        )
    row = _find(patient.medications, medication_id, "Medication")
    row.status = "entered_in_error"
    await _touch(db, patient, actor, ip, "medication.delete", row.name)


async def _simulation_nurse(db, patient: Patient, actor: User) -> None:
    from app.services.simulation import station_for

    if patient.simulation_phase == "closed":
        raise HTTPException(status.HTTP_409_CONFLICT, "This simulation note is closed.")
    if await station_for(db, patient.id, actor.id) != "nurse":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the assigned nurse records vitals in a simulation.")


async def add_vital(db, patient: Patient, actor: User, role: str, body: dict, ip: str | None) -> None:
    if patient.mode == "simulation":
        await _simulation_nurse(db, patient, actor)
    elif not _can_edit_section(role, patient, "vitals"):
        _deny("vitals")
    label = (body.get("label") or "").strip()
    value = (body.get("value") or "").strip()
    if not label or not value:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A vital needs a label and a value.")
    patient.vitals.append(
        Vital(
            label=label,
            value=value,
            recorded_at=utcnow(),
            recorded_by_name=full_name(actor),
            status="recorded",
        )
    )
    if patient.mode == "simulation" and patient.simulation_phase == "waiting_vitals":
        patient.simulation_phase = "ready"
    await _touch(db, patient, actor, ip, "vital.add", f"{label} {value}")


async def mark_vital_entered_in_error(db, patient: Patient, actor: User, role: str, vital_id: uuid.UUID, ip: str | None) -> None:
    if patient.mode == "simulation":
        await _simulation_nurse(db, patient, actor)
    elif not _can_edit_section(role, patient, "vitals"):
        _deny("vitals")
    row = _find(patient.vitals, vital_id, "Vital")
    if row.status == "entered_in_error":
        raise HTTPException(status.HTTP_409_CONFLICT, "That vital was already marked entered in error.")
    row.status = "entered_in_error"
    await _touch(db, patient, actor, ip, "vital.entered_in_error", f"{row.label} {row.value}")


async def add_lab(db, patient: Patient, actor: User, role: str, body: dict, ip: str | None) -> None:
    if not _can_edit_section(role, patient, "labs"):
        _deny("labs")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Name the lab test.")
    collected = body.get("collected_at")
    if not collected:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A lab needs the date it was collected.")
    patient.labs.append(
        LabResult(
            name=name,
            value=(body.get("value") or "").strip(),
            unit=(body.get("unit") or "").strip(),
            reference_range=(body.get("reference_range") or "").strip(),
            flag=(body.get("flag") or "").strip() or None,
            collected_at=collected,
        )
    )
    await _touch(db, patient, actor, ip, "lab.add", name)


async def add_problem(db, patient: Patient, actor: User, role: str, body: dict, ip: str | None) -> None:
    if not _can_edit_section(role, patient, "diagnoses"):
        _deny("diagnoses")
    description = (body.get("description") or "").strip()
    if not description:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Name the diagnosis.")
    patient.problems.append(
        Problem(
            code=(body.get("code") or "").strip() or None,
            description=description,
            since=(body.get("since") or "").strip() or None,
        )
    )
    await _touch(db, patient, actor, ip, "diagnosis.add", description)


async def set_history(db, patient: Patient, actor: User, role: str, section: str, value: str, ip: str | None) -> None:
    if section not in {"medical_history", "surgical_history", "chief_complaint"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That section can't be edited here.")
    if not _can_edit_section(role, patient, section):
        _deny(section)
    text = value.strip()
    if section == "medical_history":
        patient.past_medical_history = text
    elif section == "surgical_history":
        patient.surgical_history = text
    else:
        patient.chief_complaint = text
    await _touch(db, patient, actor, ip, f"{section}.update", "")


async def set_placement(db, patient: Patient, actor: User, role: str, body: dict, ip: str | None) -> None:
    if not (can(role, "patient:update_status") or can(role, "case:author")):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an instructor assigns a simulated bed.")
    patient.unit = (body.get("unit") or "").strip() or None
    patient.room = (body.get("room") or "").strip() or None
    patient.bed = (body.get("bed") or "").strip() or None
    await _touch(db, patient, actor, ip, "placement.update", " ".join(part for part in (patient.unit, patient.room, patient.bed) if part))


async def administer_medication(db, patient: Patient, actor: User, role: str, medication_id: uuid.UUID, dose: str, ip: str | None) -> None:
    if role != "student":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Students record administration. An instructor reviews it afterward.")
    if patient.care_setting != "Inpatient":
        raise HTTPException(status.HTTP_409_CONFLICT, "Medication administration is recorded for inpatient scenarios.")
    row = _find(patient.medications, medication_id, "Medication")
    if row.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only an active medication can be administered.")
    given = dose.strip() or row.dose
    db.add(
        MedicationAdministration(
            medication_id=row.id,
            patient_id=patient.id,
            student_id=actor.id,
            dose_given=given,
            administered_at=utcnow(),
            review_status="pending_review",
        )
    )
    await _touch(db, patient, actor, ip, "medication.administer", f"{row.name} {given}")


async def review_administration(db, row: MedicationAdministration, reviewer: User, role: str, decision: str, comment: str, ip: str | None, course_id) -> None:
    if not can(role, "note:cosign"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role can't review medication administration.")
    if decision not in {"accepted", "needs_follow_up"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Mark the administration accepted or needs follow-up.")
    if row.review_status != "pending_review":
        raise HTTPException(status.HTTP_409_CONFLICT, "This administration was already reviewed.")
    row.review_status = decision
    row.review_comment = comment.strip() or None
    row.reviewed_by_id = reviewer.id
    row.reviewed_at = utcnow()
    await log_event(
        db,
        action="medication.administration_review",
        entity_type="medication_administration",
        entity_id=str(row.id),
        actor_user_id=reviewer.id,
        course_id=course_id,
        ip_address=ip,
        detail=decision,
    )


async def record_presence(db, patient: Patient, user: User, ip: str | None, *, active: bool) -> None:
    if not active:
        return
    now = utcnow()
    latest = await db.scalar(
        select(ChartSession)
        .where(ChartSession.user_id == user.id, ChartSession.patient_id == patient.id)
        .order_by(ChartSession.last_seen_at.desc())
        .limit(1)
    )
    if latest is not None and (now - _aware(latest.last_seen_at)).total_seconds() <= 120:
        latest.last_seen_at = now
        return
    db.add(
        ChartSession(
            user_id=user.id,
            patient_id=patient.id,
            course_id=patient.course_id,
            started_at=now,
            last_seen_at=now,
        )
    )
    await log_event(
        db,
        action="chart.session",
        entity_type="patient",
        entity_id=str(patient.id),
        actor_user_id=user.id,
        course_id=patient.course_id,
        ip_address=ip,
    )


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _find(rows, item_id: uuid.UUID, label: str):
    for row in rows:
        if row.id == item_id:
            return row
    raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label} not found on this chart.")


async def _touch(db: AsyncSession, patient: Patient, actor: User, ip: str | None, action: str, detail: str) -> None:
    patient.updated_at = utcnow()
    await log_event(
        db,
        action=action,
        entity_type="patient",
        entity_id=str(patient.id),
        actor_user_id=actor.id,
        course_id=patient.course_id,
        ip_address=ip,
        detail=detail or None,
    )
