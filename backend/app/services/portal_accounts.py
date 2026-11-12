from __future__ import annotations

import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models.clinical import Course, Patient, PortalInvite
from app.models.user import Role, User

PATIENT_LOGIN_DOMAIN = "patients.example.com"
USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{3,29}$")
INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def normalize_login(identifier: str) -> str:
    value = identifier.strip().lower()
    return value if "@" in value else username_to_email(value)


def username_to_email(username: str) -> str:
    return f"{username.strip().lower()}@{PATIENT_LOGIN_DOMAIN}"


async def chart_is_claimed(
    db: AsyncSession, patient_id: uuid.UUID, *, exclude_user_id: uuid.UUID | None = None
) -> bool:
    query = select(User.id).where(
        User.portal_patient_id == patient_id,
        User.is_active.is_(True),
        User.deleted_at.is_(None),
        User.archived_at.is_(None),
        User.purged_at.is_(None),
    )
    if exclude_user_id is not None:
        query = query.where(User.id != exclude_user_id)
    return await db.scalar(query.limit(1)) is not None


def ensure_chart_eligible(patient: Patient, course: Course | None) -> None:
    if patient.mode not in {"practice", "assessment"} or patient.deleted_at is not None or course is None or course.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This chart is not eligible for patient portal access.")


async def create_patient_user(
    db: AsyncSession,
    patient: Patient,
    *,
    email: str,
    password: str,
    must_change_password: bool,
) -> User:
    role = await db.scalar(select(Role).where(Role.code == "patient"))
    if role is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Roles are not seeded.")
    person = User(
        email=email.strip().lower(),
        first_name=patient.first_name,
        last_name=patient.last_name,
        hashed_password=hash_password(password),
        must_change_password=must_change_password,
        is_active=True,
        portal_patient_id=patient.id,
        roles=[role],
    )
    db.add(person)
    await db.flush()
    return person


def generate_code() -> str:
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(8))


def normalize_code(code: str) -> str:
    return "".join(code.split()).replace("-", "").upper()


def hash_code(code: str) -> str:
    import hashlib
    import hmac

    return hmac.new(settings.JWT_SECRET_KEY.encode(), normalize_code(code).encode(), hashlib.sha256).hexdigest()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def create_invite(db: AsyncSession, patient: Patient, admin: User) -> tuple[str, PortalInvite]:
    now = utcnow()
    previous = (await db.scalars(
        select(PortalInvite).where(
            PortalInvite.patient_id == patient.id,
            PortalInvite.used_at.is_(None),
            PortalInvite.revoked_at.is_(None),
        ).with_for_update()
    )).all()
    for invite in previous:
        invite.revoked_at = now
    code = generate_code()
    invite = PortalInvite(
        patient_id=patient.id,
        code_hash=hash_code(code),
        created_by_user_id=admin.id,
        expires_at=now + timedelta(days=14),
    )
    db.add(invite)
    await db.flush()
    return code, invite


async def find_valid_invite(db: AsyncSession, code: str) -> PortalInvite | None:
    query = select(PortalInvite).where(PortalInvite.code_hash == hash_code(code))
    candidate = await db.scalar(query)
    if candidate is None:
        return None
    patient = await db.scalar(select(Patient).where(Patient.id == candidate.patient_id).with_for_update())
    if patient is None:
        return None
    return await db.scalar(query.with_for_update())
