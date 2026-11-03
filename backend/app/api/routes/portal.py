from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.clinical import ClinicalNote, Encounter
from app.services.access import memberships_for, require, require_held_role
from app.services.audit import log_event
from app.services.charts import load_patient

router = APIRouter(prefix="/portal", tags=["portal"])


@router.get("")
async def portal_chart(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()] = "patient",
):
    rows = await memberships_for(db, user.id)
    require_held_role(user, "patient", rows)
    require(role, "portal:view", "The portal is view-only for patient accounts.")
    if user.portal_patient_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This login is not linked to a chart.")
    patient = await load_patient(db, user.portal_patient_id)
    note = await db.scalar(
        select(ClinicalNote)
        .where(
            ClinicalNote.patient_id == patient.id,
            ClinicalNote.archived.is_(False),
            ClinicalNote.sensitive.is_(False),
            ClinicalNote.status.in_(("signed", "cosigned")),
        )
        .order_by(ClinicalNote.signed_at.desc())
    )
    summary = None
    visit = None
    if note is not None:
        parts = [f"{key}: {value}" for key, value in (note.content or {}).items() if str(value).strip()]
        summary = "\n".join(parts) if parts else None
        visit = await db.get(Encounter, note.encounter_id)
    if visit is None:
        visit = patient.encounter
    medications = [
        {
            "name": item.name,
            "dose": item.dose,
            "route": item.route,
            "frequency": item.frequency,
            "prescribed": item.prescribed,
        }
        for item in patient.medications
        if item.status == "active"
    ]
    labs = sorted(patient.labs, key=lambda lab: lab.name.casefold())
    labs.sort(key=lambda lab: lab.collected_at, reverse=True)
    result = {
        "patient": {
            "name": f"{patient.first_name} {patient.last_name}",
            "dob": patient.dob,
            "mrn": patient.mrn,
        },
        "labs": [
            {
                "name": lab.name,
                "value": lab.value,
                "unit": lab.unit,
                "reference_range": lab.reference_range,
                "flag": lab.flag,
                "collected_at": lab.collected_at,
            }
            for lab in labs
        ],
        "last_visit": {
            "date": note.signed_at.date().isoformat() if note is not None and note.signed_at else (visit.date if visit is not None else None),
            "type": visit.type if visit is not None else None,
            "summary": summary,
        },
        "insurance": {
            "payer": patient.insurance_payer,
            "member_id": patient.insurance_member_id,
            "group_number": patient.insurance_group_number,
        },
        "prescribed_medications": [item for item in medications if item["prescribed"]],
        "medication_list": medications,
    }
    await log_event(
        db,
        action="portal.view",
        entity_type="patient",
        entity_id=str(patient.id),
        actor_user_id=user.id,
        course_id=patient.course_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result
