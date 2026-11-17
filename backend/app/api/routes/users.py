import re
import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.core.security import hash_password
from app.models.clinical import Course, CourseMembership, Patient, PatientIntake
from app.models.user import Role, User
from app.schemas.clinical import PortalAccess, PublicUser, TempPassword
from app.schemas.users import AccountUpdate, DeleteAccount, UserActiveOut, UserActivePatch
from app.schemas.portal_accounts import ProvisionRequest, ProvisionResultOut
from app.schemas.intake import IntakeData, PrechartIntakeOut
from app.services.access import memberships_for, require, require_held_role
from app.services.audit import log_event
from app.services.charts import load_patient, utcnow
from app.services.retention import RETENTION, anonymize_user, purge_expired
from app.services.serialize import user_out
from app.services.portal_accounts import (
    chart_is_claimed,
    create_patient_user,
    ensure_chart_eligible,
    provision_patient_logins,
)
from app.services.intake import attach_prechart_intake

router = APIRouter(prefix="/users", tags=["users"])


def _require_account_admin(user: User, rows) -> None:
    require_held_role(user, "admin", rows)
    require("admin", "user:manage_access", "Your role can't manage accounts.")


@router.get("", response_model=list[PublicUser], response_model_exclude_none=True)
async def search_users(
    db: DbSession,
    user: CurrentUser,
    q: Annotated[str, Query()] = "",
):
    rows = await memberships_for(db, user.id)
    _require_account_admin(user, rows)
    term = " ".join(q.split()).lower()
    if len(term) < 2:
        return []
    like = f"%{term}%"
    name = func.lower(User.first_name + " " + User.last_name)
    people = (
        await db.scalars(
            select(User)
            .where(User.deleted_at.is_(None), User.purged_at.is_(None))
            .where(or_(func.lower(User.email).like(like), name.like(like)))
            .order_by(User.last_name, User.first_name)
            .limit(20)
        )
    ).all()
    return [await user_out(db, person) for person in people]


@router.patch("/{user_id}", response_model=PublicUser, response_model_exclude_none=True)
async def update_account(user_id: uuid.UUID, body: AccountUpdate, db: DbSession, user: CurrentUser, request: Request):
    rows = await memberships_for(db, user.id)
    _require_account_admin(user, rows)
    target = await db.get(User, user_id)
    if target is None or target.deleted_at is not None or target.purged_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email is required.")
    taken = await db.scalar(select(User.id).where(User.email == email, User.id != target.id))
    if taken is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Another account already uses that email.")
    full_name = " ".join(body.full_name.split())
    if not full_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Name is required.")
    university_id = (body.university_id or "").strip() or None
    is_student = await db.scalar(
        select(CourseMembership.id)
        .join(Role, Role.id == CourseMembership.role_id)
        .where(CourseMembership.user_id == target.id, Role.code == "student")
    )
    if is_student is not None and not re.fullmatch(r"800\d{6}", university_id or ""):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Students need a 9-digit 800 number.")
    first, last = _split(full_name)
    target.first_name = first
    target.last_name = last
    target.email = email
    target.university_id = university_id
    await log_event(
        db,
        action="user.update",
        entity_type="user",
        entity_id=str(target.id),
        actor_user_id=user.id,
        ip_address=request.client.host if request.client else None,
        detail=email,
    )
    await db.commit()
    return await user_out(db, target)


@router.post("/{user_id}/reset-password", response_model=TempPassword)
async def reset_password(user_id: uuid.UUID, db: DbSession, user: CurrentUser, request: Request):
    rows = await memberships_for(db, user.id)
    _require_account_admin(user, rows)
    if user_id == user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can't reset your own password here.")
    target = await db.get(User, user_id)
    if target is None or target.deleted_at is not None or target.purged_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if target.archived_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Reactivate this account before resetting the password.")
    temporary = secrets.token_urlsafe(9)
    target.hashed_password = hash_password(temporary)
    target.must_change_password = True
    await log_event(
        db,
        action="user.password_reset",
        entity_type="user",
        entity_id=str(target.id),
        actor_user_id=user.id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return TempPassword(email=target.email, password=temporary)


@router.patch("/{user_id}/active", response_model=UserActiveOut)
async def set_user_active(
    user_id: uuid.UUID, body: UserActivePatch, db: DbSession, user: CurrentUser, request: Request
):
    rows = await memberships_for(db, user.id)
    require_held_role(user, "admin", rows)
    require("admin", "user:manage_access", "Your role can't manage user access.")
    if user_id == user.id and not body.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can't deactivate your own account.")
    target = await db.get(User, user_id)
    if target is None or target.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    target.is_active = body.is_active
    await log_event(
        db,
        action="user.activate" if body.is_active else "user.deactivate",
        entity_type="user",
        entity_id=str(target.id),
        actor_user_id=user.id,
        ip_address=request.client.host if request.client else None,
        detail=f"is_active={body.is_active}",
    )
    if body.is_active and target.purged_at is None:
        target.archived_at = None
    await db.commit()
    return {"id": str(target.id), "is_active": target.is_active}


@router.post("/{user_id}/archive")
async def archive_user(user_id: uuid.UUID, db: DbSession, user: CurrentUser, request: Request):
    rows = await memberships_for(db, user.id)
    require_held_role(user, "admin", rows)
    require("admin", "user:manage_access", "Your role can't archive accounts.")
    if user_id == user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can't archive your own account.")
    target = await db.get(User, user_id)
    if target is None or target.deleted_at is not None or target.purged_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    target.archived_at = utcnow()
    target.is_active = False
    await log_event(
        db,
        action="user.archive",
        entity_type="user",
        entity_id=str(target.id),
        actor_user_id=user.id,
        ip_address=request.client.host if request.client else None,
        detail=f"retained until {(target.archived_at + RETENTION).date().isoformat()}",
    )
    await db.commit()
    return {"id": str(target.id), "archived_at": target.archived_at}


@router.post("/{user_id}/delete")
async def delete_account(user_id: uuid.UUID, body: DeleteAccount, db: DbSession, user: CurrentUser, request: Request):
    rows = await memberships_for(db, user.id)
    _require_account_admin(user, rows)
    if user_id == user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can't delete your own account.")
    target = await db.get(User, user_id)
    if target is None or target.deleted_at is not None or target.purged_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if body.email.strip().lower() != target.email.lower():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Type the account email to confirm.")
    await anonymize_user(db, target)
    await log_event(
        db,
        action="user.delete",
        entity_type="user",
        entity_id=str(target.id),
        actor_user_id=user.id,
        ip_address=request.client.host if request.client else None,
        detail="login anonymized; charts and notes kept",
    )
    await db.commit()
    return {"id": str(target.id)}


@router.post("/purge-expired")
async def purge(db: DbSession, user: CurrentUser, request: Request):
    rows = await memberships_for(db, user.id)
    require_held_role(user, "admin", rows)
    require("admin", "user:manage_access", "Your role can't purge archived accounts.")
    count = await purge_expired(db)
    await log_event(
        db,
        action="user.purge_expired",
        entity_type="user",
        entity_id=str(user.id),
        actor_user_id=user.id,
        ip_address=request.client.host if request.client else None,
        detail=str(count),
    )
    await db.commit()
    return {"purged": count}


@router.get("/prechart-intakes", response_model=list[PrechartIntakeOut])
async def list_prechart_intakes(db: DbSession, user: CurrentUser, request: Request):
    rows = await memberships_for(db, user.id)
    _require_account_admin(user, rows)
    records = (await db.execute(
        select(PatientIntake, User)
        .join(User, User.id == PatientIntake.user_id)
        .where(
            PatientIntake.patient_id.is_(None),
            User.is_active.is_(True),
            User.deleted_at.is_(None),
            User.archived_at.is_(None),
            User.purged_at.is_(None),
        )
        .order_by(PatientIntake.updated_at.desc())
    )).all()
    await log_event(
        db,
        action="portal.intake.prechart.list",
        entity_type="portal_intake_queue",
        actor_user_id=user.id,
        ip_address=request.client.host if request.client else None,
        detail=str(len(records)),
    )
    await db.commit()
    return [
        PrechartIntakeOut(
            user_id=str(person.id),
            email=person.email,
            first_name=person.first_name,
            last_name=person.last_name,
            data=IntakeData.model_validate(intake.data),
            updated_at=intake.updated_at,
        )
        for intake, person in records
    ]


@router.post("/portal-access")
async def portal_access(body: PortalAccess, db: DbSession, user: CurrentUser, request: Request):
    rows = await memberships_for(db, user.id)
    require_held_role(user, "admin", rows)
    require("admin", "user:manage_access", "Your role can't create portal access.")
    patient = await db.scalar(
        select(Patient).where(Patient.id == body.patient_id, Patient.deleted_at.is_(None)).with_for_update()
    )
    if patient is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This patient doesn't exist or was archived.")
    course = await db.get(Course, patient.course_id)
    ensure_chart_eligible(patient, course)
    email = body.email.strip().lower()
    person = await db.scalar(
        select(User).options(selectinload(User.roles)).where(User.email == email)
    )
    if await chart_is_claimed(db, patient.id, exclude_user_id=person.id if person else None):
        raise HTTPException(status.HTTP_409_CONFLICT, "This chart already has a portal login.")
    temporary = None
    if person is None:
        temporary = secrets.token_urlsafe(9)
        person = await create_patient_user(
            db,
            patient,
            email=email,
            password=temporary,
            must_change_password=True,
        )
    else:
        role_codes = {role.code for role in person.roles}
        if (
            role_codes != {"patient"}
            or not person.is_active
            or person.deleted_at is not None
            or person.archived_at is not None
            or person.purged_at is not None
            or person.portal_patient_id not in (None, patient.id)
        ):
            raise HTTPException(status.HTTP_409_CONFLICT, "That email already belongs to another account.")
        person.portal_patient_id = patient.id
    await attach_prechart_intake(db, person, patient)
    await log_event(
        db,
        action="user.portal_access",
        entity_type="user",
        entity_id=str(person.id),
        actor_user_id=user.id,
        course_id=patient.course_id,
        ip_address=request.client.host if request.client else None,
        detail=str(patient.id),
    )
    await db.commit()
    return {"id": str(person.id), "email": person.email, "temporaryPassword": temporary}


@router.post("/portal-logins/provision")
async def provision_portal_logins(body: ProvisionRequest, db: DbSession, user: CurrentUser):
    rows = await memberships_for(db, user.id)
    _require_account_admin(user, rows)
    result = await provision_patient_logins(
        db,
        apply=not body.dry_run,
        modes=tuple(body.modes),
        course_code=body.course_code,
        limit=body.limit,
    )
    if body.dry_run:
        return ProvisionResultOut(
            eligible=result.eligible,
            created=result.created,
            skipped_claimed=result.skipped_claimed,
            skipped_case_masters=result.skipped_case_masters,
            skipped_inactive_course=result.skipped_inactive_course,
            remaining=result.remaining,
            rows=[
                {
                    "username": item.username,
                    "patientName": item.patient_name,
                    "mrn": item.mrn,
                    "courseCode": item.course_code,
                    "mode": item.mode,
                }
                for item in result.rows
            ],
        )

    await log_event(
        db,
        action="portal.logins_provisioned",
        entity_type="portal_logins",
        actor_user_id=user.id,
        details={
            "eligible": result.eligible,
            "created": result.created,
            "skipped_claimed": result.skipped_claimed,
            "skipped_case_masters": result.skipped_case_masters,
            "skipped_inactive_course": result.skipped_inactive_course,
            "remaining": result.remaining,
        },
    )
    await db.commit()
    from io import StringIO

    output = StringIO(newline="")
    import csv

    writer = csv.writer(output)
    writer.writerow(["username", "temporaryPassword", "patientName", "mrn", "course", "mode"])
    for item in result.rows:
        writer.writerow([
            item.username,
            item.temporary_password,
            item.patient_name,
            item.mrn,
            item.course_code,
            item.mode,
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": 'attachment; filename="patient-logins.csv"',
        },
    )


def _split(full_name: str) -> tuple[str, str]:
    cleaned = " ".join(full_name.split())
    if " " not in cleaned:
        return cleaned or "Portal", cleaned or "Patient"
    first, last = cleaned.rsplit(" ", 1)
    return first, last
