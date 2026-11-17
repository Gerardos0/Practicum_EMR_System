import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select
from app.api.deps import CurrentUser, DbSession
from app.models.audit import AuditEvent
from app.models.clinical import ClinicalNote, MedicationAdministration
from app.models.user import User
from app.schemas.clinical import AuditOut
from app.services.access import full_name, memberships_for, require, require_course, require_held_role
from app.services.charts import ensure_visible, load_patient

router = APIRouter(prefix="/audit", tags=["audit"])


async def _events_for_patient(db: DbSession, patient_id: uuid.UUID) -> list[AuditEvent]:
    note_ids = [str(item) for item in (await db.scalars(select(ClinicalNote.id).where(ClinicalNote.patient_id == patient_id))).all()]
    administration_ids = [
        str(item)
        for item in (
            await db.scalars(select(MedicationAdministration.id).where(MedicationAdministration.patient_id == patient_id))
        ).all()
    ]
    matched = [((AuditEvent.entity_type == "patient") & (AuditEvent.entity_id == str(patient_id)))]
    if note_ids:
        matched.append((AuditEvent.entity_type == "note") & (AuditEvent.entity_id.in_(note_ids)))
    if administration_ids:
        matched.append((AuditEvent.entity_type == "medication_administration") & (AuditEvent.entity_id.in_(administration_ids)))
    statement = select(AuditEvent).where(or_(*matched)).order_by(AuditEvent.occurred_at.desc()).limit(300)
    return list((await db.scalars(statement)).all())


@router.get("", response_model=list[AuditOut], response_model_exclude_none=True)
async def list_audit(
    db: DbSession,
    user: CurrentUser,
    role: Annotated[str, Query()],
    course_id: Annotated[uuid.UUID | None, Query()] = None,
    patient_id: Annotated[uuid.UUID | None, Query()] = None,
):
    rows = await memberships_for(db, user.id)
    require(role, "audit:view", "Your role can't view the audit log.")
    if patient_id is not None:
        patient = await load_patient(db, patient_id)
        await ensure_visible(db, patient, user, role, rows, request_ip=None)
        if course_id is not None and course_id != patient.course_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "This patient isn't in that class.")
        events = await _events_for_patient(db, patient.id)
    else:
        if course_id is None:
            if role != "admin":
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose a course to view its activity.")
            require_held_role(user, role, rows)
        else:
            require_course(role, course_id, user, rows)
        statement = select(AuditEvent).order_by(AuditEvent.occurred_at.desc()).limit(300)
        if course_id is not None:
            statement = statement.where(AuditEvent.course_id == course_id)
        events = list((await db.scalars(statement)).all())
    payload = []
    for event in events:
        actor = await db.get(User, event.actor_user_id) if event.actor_user_id else None
        entity = event.entity_type if not event.entity_id else f"{event.entity_type}/{event.entity_id}"
        detail = (event.details or {}).get("detail")
        payload.append(
            {
                "id": str(event.id),
                "timestamp": event.occurred_at,
                "actor_id": str(event.actor_user_id) if event.actor_user_id else "",
                "actor_name": full_name(actor) if actor else "Unknown",
                "action": event.action,
                "entity": entity,
                "result": event.result,
                "detail": detail,
            }
        )
    return payload
