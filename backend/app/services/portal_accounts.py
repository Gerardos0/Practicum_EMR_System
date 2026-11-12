from __future__ import annotations

import re
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.clinical import Course, Patient
from app.models.user import Role, User

PATIENT_LOGIN_DOMAIN = "patients.example.com"
USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{3,29}$")


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
