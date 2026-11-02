import secrets
import uuid

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.security import hash_password
from app.models.user import Role, User
from app.schemas.clinical import PortalAccess
from app.schemas.users import UserActiveOut, UserActivePatch
from app.services.access import memberships_for, require, require_held_role
from app.services.audit import log_event
from app.services.charts import load_patient, utcnow
from app.services.retention import RETENTION, purge_expired

router = APIRouter(prefix="/users", tags=["users"])


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


@router.post("/portal-access")
async def portal_access(body: PortalAccess, db: DbSession, user: CurrentUser, request: Request):
    rows = await memberships_for(db, user.id)
    require_held_role(user, "admin", rows)
    require("admin", "user:manage_access", "Your role can't create portal access.")
    patient = await load_patient(db, body.patient_id)
    email = body.email.strip().lower()
    person = await db.scalar(select(User).where(User.email == email))
    temporary = None
    if person is None:
        first, last = _split(body.full_name)
        temporary = secrets.token_urlsafe(9)
        person = User(
            email=email,
            first_name=first,
            last_name=last,
            hashed_password=hash_password(temporary),
            must_change_password=True,
            is_active=True,
            portal_patient_id=patient.id,
        )
        db.add(person)
        await db.flush()
    else:
        person.portal_patient_id = patient.id
        person.is_active = True
        person.archived_at = None
    patient_role = await db.scalar(select(Role).where(Role.code == "patient"))
    if patient_role is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Roles are not seeded.")
    await db.refresh(person, attribute_names=["roles"])
    if patient_role not in person.roles:
        person.roles.append(patient_role)
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
    return {"id": str(person.id), "email": person.email, "temporary_password": temporary}


def _split(full_name: str) -> tuple[str, str]:
    cleaned = " ".join(full_name.split())
    if " " not in cleaned:
        return cleaned or "Portal", cleaned or "Patient"
    first, last = cleaned.rsplit(" ", 1)
    return first, last