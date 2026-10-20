"""One answer key per case master. Students cannot read it, even after a release timestamp is set."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clinical import CaseAnswerKey, Patient
from app.models.user import User
from app.schemas.clinical import AnswerKeyIn
from app.services.access import can, require_course
from app.services.audit import log_event


def can_read_answer_key(role: str) -> bool:
    return can(role, "case:author") or can(role, "note:cosign")


async def deny_answer_key(
    db: AsyncSession,
    *,
    user: User,
    role: str,
    rows,
    course_id: uuid.UUID,
    entity_id: str,
    ip: str | None,
    action: str,
) -> None:
    require_course(role, course_id, user, rows)
    allowed = can(role, "case:author") if action == "answer_key.update" else can_read_answer_key(role)
    if allowed:
        return
    await log_event(
        db,
        action="answer_key.view" if action != "answer_key.update" else action,
        entity_type="patient",
        entity_id=entity_id,
        actor_user_id=user.id,
        result="denied",
        course_id=course_id,
        ip_address=ip,
        detail="Role cannot view answer keys." if action != "answer_key.update" else "Role cannot edit answer keys.",
    )
    await db.commit()
    message = "Your role can't edit answer keys." if action == "answer_key.update" else "Your role can't view answer keys."
    raise HTTPException(status.HTTP_403_FORBIDDEN, message)


async def read_answer_key(db: AsyncSession, patient: Patient) -> dict:
    row = await _row_for(db, patient)
    return _out(row)


async def upsert_answer_key(db: AsyncSession, patient: Patient, body: AnswerKeyIn, actor: User) -> dict:
    if patient.mode != "case":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Answer keys belong to the case master.")
    diagnoses = _diagnoses(body)
    points = [point.strip() for point in body.plan_points if point.strip()]
    row = await db.scalar(select(CaseAnswerKey).where(CaseAnswerKey.patient_id == patient.id))
    if row is None:
        row = CaseAnswerKey(
            patient_id=patient.id,
            diagnoses=diagnoses,
            plan_points=points,
            rationale=body.rationale.strip(),
            updated_by_id=actor.id,
        )
        db.add(row)
    else:
        row.diagnoses = diagnoses
        row.plan_points = points
        row.rationale = body.rationale.strip()
        row.updated_by_id = actor.id
    await db.flush()
    await db.refresh(row)
    return _out(row)


async def _row_for(db: AsyncSession, patient: Patient) -> CaseAnswerKey | None:
    master_id = patient.id if patient.mode == "case" else patient.source_patient_id
    if master_id is None:
        return None
    if patient.mode != "case":
        master = await db.get(Patient, master_id)
        if master is None or master.mode != "case" or master.deleted_at is not None:
            return None
        master_id = master.id
    return await db.scalar(select(CaseAnswerKey).where(CaseAnswerKey.patient_id == master_id))


def _diagnoses(body: AnswerKeyIn) -> list[dict]:
    cleaned = []
    for item in body.diagnoses:
        code = item.code.strip()
        label = item.label.strip()
        if not code or not label:
            continue
        cleaned.append({
            "rank": len(cleaned) + 1,
            "code": code,
            "label": label,
            "rationale": item.rationale.strip(),
        })
    return cleaned


def _out(row: CaseAnswerKey | None) -> dict:
    if row is None:
        return {"diagnoses": [], "plan_points": [], "rationale": ""}
    return {
        "diagnoses": list(row.diagnoses or []),
        "plan_points": list(row.plan_points or []),
        "rationale": row.rationale or "",
        "updated_at": row.updated_at,
    }
