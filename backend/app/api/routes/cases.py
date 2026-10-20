import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.clinical import AnswerKeyIn, AnswerKeyOut, CaseIn, CaseOut
from app.services.access import can, ensure_course_open, memberships_for, require_course
from app.services.answer_keys import deny_answer_key, read_answer_key, upsert_answer_key
from app.services.audit import log_event
from app.services.cases import create_case, list_cases, load_case, update_case
from app.services.serialize import authored_case_out

router = APIRouter(prefix="/cases", tags=["cases"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def _require_author(db, user, role: str, rows, course_id: uuid.UUID, request: Request, action: str) -> None:
    require_course(role, course_id, user, rows)
    if can(role, "case:author"):
        return
    await log_event(
        db,
        action=action,
        entity_type="patient",
        entity_id=str(course_id),
        actor_user_id=user.id,
        result="denied",
        course_id=course_id,
        ip_address=_ip(request),
        detail="Role cannot author cases.",
    )
    await db.commit()
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role can't author cases.")


@router.get("", response_model=list[CaseOut], response_model_exclude_none=True)
async def get_cases(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    course_id: Annotated[uuid.UUID, Query()],
    role: Annotated[str, Query()],
):
    rows = await memberships_for(db, user.id)
    await _require_author(db, user, role, rows, course_id, request, "case.list")
    cases = await list_cases(db, course_id)
    return [authored_case_out(case) for case in cases]


@router.post("", response_model=CaseOut, response_model_exclude_none=True)
async def post_case(
    body: CaseIn,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    course_id: Annotated[uuid.UUID, Query()],
    role: Annotated[str, Query()],
):
    rows = await memberships_for(db, user.id)
    await _require_author(db, user, role, rows, course_id, request, "case.create")
    await ensure_course_open(db, course_id)
    patient = await create_case(db, body=body, actor=user, course_id=course_id, ip=_ip(request))
    await db.commit()
    return authored_case_out(patient)


@router.get("/{case_id}", response_model=CaseOut, response_model_exclude_none=True)
async def get_case(
    case_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_case(db, case_id)
    rows = await memberships_for(db, user.id)
    await _require_author(db, user, role, rows, patient.course_id, request, "case.view")
    await log_event(
        db,
        action="case.view",
        entity_type="patient",
        entity_id=str(patient.id),
        actor_user_id=user.id,
        course_id=patient.course_id,
        ip_address=_ip(request),
    )
    await db.commit()
    return authored_case_out(patient)


@router.patch("/{case_id}", response_model=CaseOut, response_model_exclude_none=True)
async def patch_case(
    case_id: uuid.UUID,
    body: CaseIn,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_case(db, case_id)
    rows = await memberships_for(db, user.id)
    await _require_author(db, user, role, rows, patient.course_id, request, "case.update")
    await ensure_course_open(db, patient.course_id)
    updated = await update_case(db, patient=patient, body=body, actor=user, ip=_ip(request))
    await db.commit()
    return authored_case_out(updated)


@router.get("/{case_id}/answer-key", response_model=AnswerKeyOut, response_model_exclude_none=True)
async def get_case_answer_key(
    case_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_case(db, case_id)
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


@router.put("/{case_id}/answer-key", response_model=AnswerKeyOut, response_model_exclude_none=True)
async def put_case_answer_key(
    case_id: uuid.UUID,
    body: AnswerKeyIn,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    role: Annotated[str, Query()],
):
    patient = await load_case(db, case_id)
    rows = await memberships_for(db, user.id)
    await deny_answer_key(
        db, user=user, role=role, rows=rows, course_id=patient.course_id,
        entity_id=str(patient.id), ip=_ip(request), action="answer_key.update",
    )
    await ensure_course_open(db, patient.course_id)
    payload = await upsert_answer_key(db, patient, body, user)
    await log_event(
        db, action="answer_key.update", entity_type="patient", entity_id=str(patient.id),
        actor_user_id=user.id, course_id=patient.course_id, ip_address=_ip(request),
    )
    await db.commit()
    return payload
