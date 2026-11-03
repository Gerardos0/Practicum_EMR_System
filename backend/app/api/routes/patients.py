import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.clinical import ClinicalNote, Patient
from app.models.user import User
from app.models.clinical import MedicationAdministration
from app.schemas.clinical import (
    AdministerWrite,
    AdministrationReview,
    AllergyWrite,
    AnswerKeyOut,
    AssignCase,
    HistoryWrite,
    LabWrite,
    MedicationWrite,
    PatientOut,
    PatientRowOut,
    PlacementWrite,
    PresenceIn,
    ProblemWrite,
    StatusPatch,
    TriggersOut,
    VitalWrite,
)
from app.services.chart_edits import (
    add_allergy,
    add_lab,
    add_medication,
    add_problem,
    add_vital,
    administer_medication,
    mark_vital_entered_in_error,
    delete_allergy,
    delete_medication,
    discontinue_medication,
    record_presence,
    review_administration,
    set_history,
    set_placement,
    update_allergy,
    update_medication,
)
from app.services.access import ensure_course_open, memberships_for, require_course
from app.services.answer_keys import deny_answer_key, read_answer_key
from app.services.cases import deny_triggers, grading_guide_for, triggers_for
from app.services.audit import log_event
from app.services.charts import apply_status, assign_case, ensure_visible, load_patient, owner_name_for, reset_practice, unassign_case
from app.services.serialize import patient_out

router = APIRouter(prefix="/patients", tags=["patients"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=list[PatientRowOut], response_model_exclude_none=True)
async def list_patients(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    course_id: Annotated[uuid.UUID, Query()],
    role: Annotated[str, Query()],
):
    rows = await memberships_for(db, user.id)
    from app.services.access import require_course

    require_course(role, course_id, user, rows)
    patients = list(
        (
            await db.scalars(
                select(Patient).where(
                    Patient.course_id == course_id,
                    Patient.deleted_at.is_(None),
                    Patient.mode != "case",
                ).order_by(Patient.last_name)
            )
        ).all()
    )
    visible = []
    for patient in patients:
        if role == "student" and not (patient.mode == "practice" or patient.owner_id == user.id):
            continue
        if role not in {"student", "instructor", "course_coordinator", "admin", "front_desk"}:
            continue
        author_id = user.id if role == "student" else patient.owner_id
        note_query = select(ClinicalNote).where(ClinicalNote.patient_id == patient.id, ClinicalNote.archived.is_(False))
        if author_id is not None and role == "student":
            note_query = note_query.where(ClinicalNote.author_id == author_id)
        elif role != "student" and patient.owner_id is not None:
            note_query = note_query.where(ClinicalNote.author_id == patient.owner_id)
        latest = await db.scalar(note_query.order_by(ClinicalNote.updated_at.desc()))
        shown_owner = full_owner(patient)
        visible.append(
            {
                "patient": patient_out(patient, owner_name=owner_name_for(patient, role), viewer_role=role),
                "owner_name": shown_owner,
                "latest_note": {"status": latest.status, "updated_at": latest.updated_at} if latest else None,
            }
        )
    return visible


@router.post("", response_model=PatientOut, response_model_exclude_none=True)
async def assign_patient(
    body: AssignCase,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    course_id: Annotated[uuid.UUID, Query()],
    role: Annotated[str, Query()],
):
    rows = await memberships_for(db, user.id)
    require_course(role, course_id, user, rows)
    await ensure_course_open(db, course_id)
    source = await load_patient(db, body.source_patient_id)
    owner = await db.get(User, body.owner_id)
    if owner is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That student isn't on the roster.")
    clone = await assign_case(
        db, source=source, owner=owner, actor=user, role=role, course_id=course_id, ip=_ip(request),
    )
    await db.commit()
    return patient_out(clone, owner_name=owner_name_for(clone, role), viewer_role=role)


def full_owner(patient: Patient) -> str | None:
    if patient.owner is None:
        return None
    return f"{patient.owner.first_name} {patient.owner.last_name}"


@router.get("/{patient_id}", response_model=PatientOut, response_model_exclude_none=True)
async def get_patient(
    patient_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_patient(db, patient_id)
    rows = await memberships_for(db, user.id)
    await ensure_visible(db, patient, user, role, rows, request_ip=_ip(request))
    await log_event(
        db,
        action="chart.view",
        entity_type="patient",
        entity_id=str(patient.id),
        actor_user_id=user.id,
        course_id=patient.course_id,
        ip_address=_ip(request),
    )
    await db.commit()
    return patient_out(patient, owner_name=owner_name_for(patient, role), viewer_role=role)


@router.get("/{patient_id}/answer-key", response_model=AnswerKeyOut, response_model_exclude_none=True)
async def get_copy_answer_key(
    patient_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_patient(db, patient_id)
    rows = await memberships_for(db, user.id)
    await deny_answer_key(
        db, user=user, role=role, rows=rows, course_id=patient.course_id,
        entity_id=str(patient.id), ip=_ip(request), action="answer_key.view",
    )
    payload = await read_answer_key(db, patient)
    await log_event(
        db, action="answer_key.view", entity_type="patient", entity_id=str(patient.id),
        actor_user_id=user.id, course_id=patient.course_id, ip_address=_ip(request),
    )
    await db.commit()
    return payload


@router.get("/{patient_id}/grading-guide")
async def get_chart_grading_guide(
    patient_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_patient(db, patient_id)
    rows = await memberships_for(db, user.id)
    await ensure_visible(db, patient, user, role, rows, request_ip=_ip(request))
    return await grading_guide_for(db, patient)


@router.get("/{patient_id}/triggers", response_model=TriggersOut, response_model_exclude_none=True)
async def get_chart_triggers(
    patient_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_patient(db, patient_id)
    rows = await memberships_for(db, user.id)
    await deny_triggers(
        db, user=user, role=role, rows=rows, course_id=patient.course_id,
        entity_id=str(patient.id), ip=_ip(request),
    )
    payload = await triggers_for(db, patient)
    await log_event(
        db, action="triggers.view", entity_type="patient", entity_id=str(patient.id),
        actor_user_id=user.id, course_id=patient.course_id, ip_address=_ip(request),
    )
    await db.commit()
    return {"triggers": payload}


@router.patch("/{patient_id}/status", response_model=PatientOut, response_model_exclude_none=True)
async def update_status(
    patient_id: uuid.UUID,
    body: StatusPatch,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_patient(db, patient_id)
    rows = await memberships_for(db, user.id)
    await ensure_visible(db, patient, user, role, rows, request_ip=_ip(request))
    await ensure_course_open(db, patient.course_id)
    await apply_status(db, patient, user, role, body.model_dump(exclude_unset=True), _ip(request))
    await db.commit()
    return patient_out(patient, owner_name=owner_name_for(patient, role), viewer_role=role)


@router.post("/{patient_id}/reset", status_code=204)
async def reset_patient(
    patient_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_patient(db, patient_id)
    rows = await memberships_for(db, user.id)
    await ensure_visible(db, patient, user, role, rows, request_ip=_ip(request))
    await ensure_course_open(db, patient.course_id)
    await reset_practice(db, patient, user, role, _ip(request))
    await db.commit()


@router.delete("/{patient_id}", status_code=204)
async def unassign_patient(
    patient_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_patient(db, patient_id)
    rows = await memberships_for(db, user.id)
    await ensure_visible(db, patient, user, role, rows, request_ip=_ip(request))
    await ensure_course_open(db, patient.course_id)
    await unassign_case(db, patient, user, role, _ip(request))
    await db.commit()


async def _open_chart(patient_id, db, user, request, role):
    patient = await load_patient(db, patient_id)
    rows = await memberships_for(db, user.id)
    await ensure_visible(db, patient, user, role, rows, request_ip=_ip(request))
    await ensure_course_open(db, patient.course_id)
    return patient


@router.post("/{patient_id}/presence", status_code=204)
async def presence(
    patient_id: uuid.UUID,
    body: PresenceIn,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_patient(db, patient_id)
    rows = await memberships_for(db, user.id)
    await ensure_visible(db, patient, user, role, rows, request_ip=_ip(request))
    await record_presence(db, patient, user, _ip(request), active=body.active)
    await db.commit()


@router.post("/{patient_id}/allergies", response_model=PatientOut, response_model_exclude_none=True)
async def post_allergy(patient_id: uuid.UUID, body: AllergyWrite, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await add_allergy(db, patient, user, role, body.model_dump(), _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.patch("/{patient_id}/allergies/{allergy_id}", response_model=PatientOut, response_model_exclude_none=True)
async def patch_allergy(patient_id: uuid.UUID, allergy_id: uuid.UUID, body: AllergyWrite, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await update_allergy(db, patient, user, role, allergy_id, body.model_dump(exclude_unset=True), _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.delete("/{patient_id}/allergies/{allergy_id}", response_model=PatientOut, response_model_exclude_none=True)
async def remove_allergy(patient_id: uuid.UUID, allergy_id: uuid.UUID, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await delete_allergy(db, patient, user, role, allergy_id, _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.post("/{patient_id}/medications", response_model=PatientOut, response_model_exclude_none=True)
async def post_medication(patient_id: uuid.UUID, body: MedicationWrite, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await add_medication(db, patient, user, role, body.model_dump(), _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.patch("/{patient_id}/medications/{medication_id}", response_model=PatientOut, response_model_exclude_none=True)
async def patch_medication(patient_id: uuid.UUID, medication_id: uuid.UUID, body: MedicationWrite, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await update_medication(db, patient, user, role, medication_id, body.model_dump(exclude_unset=True), _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.post("/{patient_id}/medications/{medication_id}/discontinue", response_model=PatientOut, response_model_exclude_none=True)
async def discontinue(patient_id: uuid.UUID, medication_id: uuid.UUID, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await discontinue_medication(db, patient, user, role, medication_id, _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.delete("/{patient_id}/medications/{medication_id}", response_model=PatientOut, response_model_exclude_none=True)
async def remove_medication(
    patient_id: uuid.UUID,
    medication_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
    reason: Annotated[str | None, Query()] = None,
):
    patient = await _open_chart(patient_id, db, user, request, role)
    await delete_medication(db, patient, user, role, medication_id, reason, _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.post("/{patient_id}/medications/{medication_id}/administrations", status_code=201)
async def administer(patient_id: uuid.UUID, medication_id: uuid.UUID, body: AdministerWrite, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await administer_medication(db, patient, user, role, medication_id, body.dose_given, _ip(request))
    await db.commit()
    return {"status": "pending_review"}


@router.post("/{patient_id}/vitals", response_model=PatientOut, response_model_exclude_none=True)
async def post_vital(patient_id: uuid.UUID, body: VitalWrite, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await add_vital(db, patient, user, role, body.model_dump(), _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.post("/{patient_id}/vitals/{vital_id}/entered-in-error", response_model=PatientOut, response_model_exclude_none=True)
async def vital_entered_in_error(
    patient_id: uuid.UUID,
    vital_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await _open_chart(patient_id, db, user, request, role)
    await mark_vital_entered_in_error(db, patient, user, role, vital_id, _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.post("/{patient_id}/labs", response_model=PatientOut, response_model_exclude_none=True)
async def post_lab(patient_id: uuid.UUID, body: LabWrite, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await add_lab(db, patient, user, role, body.model_dump(), _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.post("/{patient_id}/problems", response_model=PatientOut, response_model_exclude_none=True)
async def post_problem(patient_id: uuid.UUID, body: ProblemWrite, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await add_problem(db, patient, user, role, body.model_dump(), _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.patch("/{patient_id}/history", response_model=PatientOut, response_model_exclude_none=True)
async def patch_history(patient_id: uuid.UUID, body: HistoryWrite, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await set_history(db, patient, user, role, body.section, body.value, _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.patch("/{patient_id}/placement", response_model=PatientOut, response_model_exclude_none=True)
async def patch_placement(patient_id: uuid.UUID, body: PlacementWrite, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    await set_placement(db, patient, user, role, body.model_dump(), _ip(request))
    await db.commit()
    return patient_out(await load_patient(db, patient.id), owner_name=owner_name_for(patient, role), viewer_role=role)


@router.get("/{patient_id}/administrations")
async def list_administrations(patient_id: uuid.UUID, db: DbSession, user: CurrentUser, request: Request, role: Annotated[str, Query()]):
    patient = await _open_chart(patient_id, db, user, request, role)
    rows = (
        await db.scalars(
            select(MedicationAdministration)
            .where(MedicationAdministration.patient_id == patient.id)
            .order_by(MedicationAdministration.administered_at.desc())
        )
    ).all()
    return [
        {
            "id": str(row.id),
            "medicationName": row.medication.name if row.medication else "",
            "doseGiven": row.dose_given,
            "studentName": row.student.full_name if row.student else "",
            "administeredAt": row.administered_at,
            "reviewStatus": row.review_status,
            "reviewComment": row.review_comment,
        }
        for row in rows
    ]


@router.post("/administrations/{administration_id}/review", status_code=204)
async def review_admin(
    administration_id: uuid.UUID,
    body: AdministrationReview,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    row = await db.get(MedicationAdministration, administration_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Administration not found.")
    patient = await load_patient(db, row.patient_id)
    rows = await memberships_for(db, user.id)
    await ensure_visible(db, patient, user, role, rows, request_ip=_ip(request))
    await review_administration(db, row, user, role, body.decision, body.comment, _ip(request), patient.course_id)
    await db.commit()
