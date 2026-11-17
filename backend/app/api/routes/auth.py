from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DbSession, get_current_user_allow_password_change
from app.core.security import create_access_token, hash_password, verify_password
from app.models.audit import AuditEvent
from app.models.clinical import Course, Patient
from app.models.user import User

from app.schemas.auth import ChangePasswordRequest, RefreshRequest, Token
from app.schemas.clinical import PublicUser
from app.schemas.portal_accounts import PatientEmailSignupIn, PatientSignupIn
from app.services.audit import log_event
from app.services.auth import authenticate_user, get_user_by_email, get_user_by_id, is_usable
from app.services.portal_accounts import (
    chart_is_claimed,
    create_patient_user,
    create_unlinked_patient_user,
    ensure_chart_eligible,
    find_valid_invite,
    normalize_login,
    username_to_email,
)
from app.services.serialize import user_out
from app.services.sessions import issue_refresh_token, revoke_refresh_token, rotate_refresh_token

router = APIRouter(prefix="/auth", tags=["auth"])

UserAllowPwChange = Annotated[User, Depends(get_current_user_allow_password_change)]


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def _token_for(db: DbSession, user: User) -> Token:
    refresh = await issue_refresh_token(db, user.id)
    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=refresh,
        must_change_password=user.must_change_password,
        user=PublicUser.model_validate(await user_out(db, user)),
    )


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],  # "username" field = email
    db: DbSession,
):
    email = normalize_login(form.username)
    now = datetime.now(timezone.utc)
    existing = await get_user_by_email(db, email)
    if existing is not None and existing.locked_until is not None and existing.locked_until > now:
        raise HTTPException(status.HTTP_423_LOCKED, "This account is locked. Try again in 15 minutes.")
    user = await authenticate_user(db, email, form.password)
    if user is None:
        if existing is not None and is_usable(existing):
            existing.failed_login_count = (existing.failed_login_count or 0) + 1
            locked = existing.failed_login_count >= 5
            if locked:
                existing.locked_until = now + timedelta(minutes=15)
            await log_event(
                db,
                action="auth.locked" if locked else "auth.login_failed",
                entity_type="user",
                actor_user_id=existing.id,
                entity_id=str(existing.id),
                ip_address=_client_ip(request),
                details={"email": email.lower()},
            )
            await db.commit()
            if locked:
                raise HTTPException(status.HTTP_423_LOCKED, "This account is locked. Try again in 15 minutes.")
        else:
            await log_event(
                db,
                action="auth.login_failed",
                entity_type="user",
                ip_address=_client_ip(request),
                details={"email": email.lower()},
            )
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    await log_event(
        db,
        action="auth.login",
        entity_type="user",
        actor_user_id=user.id,
        entity_id=str(user.id),
        ip_address=_client_ip(request),
    )
    token = await _token_for(db, user)
    await db.commit()
    return token


@router.post("/patient-signup", response_model=Token)
async def patient_signup(body: PatientSignupIn, request: Request, db: DbSession):
    ip = _client_ip(request)
    now = datetime.now(timezone.utc)
    attempts = await db.scalar(
        select(func.count(AuditEvent.id)).where(
            AuditEvent.action == "portal.signup_failed",
            AuditEvent.ip_address == ip,
            AuditEvent.occurred_at >= now - timedelta(minutes=15),
        )
    )
    if (attempts or 0) >= 10:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Try again in 15 minutes.")

    invite = await find_valid_invite(db, body.code)
    patient = await db.get(Patient, invite.patient_id) if invite else None
    course = await db.get(Course, patient.course_id) if patient else None
    eligible = bool(
        invite is not None
        and invite.expires_at > now
        and invite.used_at is None
        and invite.revoked_at is None
    )
    if eligible and patient is not None:
        try:
            ensure_chart_eligible(patient, course)
        except HTTPException:
            eligible = False
        if eligible and await chart_is_claimed(db, patient.id):
            eligible = False
    else:
        eligible = False

    if not eligible or invite is None or patient is None:
        await log_event(db, action="portal.signup_failed", entity_type="patient", ip_address=ip)
        await db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That code isn't valid or has expired.")

    email = username_to_email(body.username)
    if await get_user_by_email(db, email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That username is taken. Try another.")

    try:
        person = await create_patient_user(
            db, patient, email=email, password=body.password, must_change_password=False
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That username is taken. Try another.")
    person.last_login_at = now
    invite.used_at = now
    invite.used_by_user_id = person.id
    await log_event(
        db,
        action="portal.signup",
        entity_type="patient",
        actor_user_id=person.id,
        entity_id=str(patient.id),
        course_id=patient.course_id,
        ip_address=ip,
    )
    token = await _token_for(db, person)
    await db.commit()
    return token


@router.post("/patient-signup-by-email", response_model=Token)
async def patient_signup_by_email(body: PatientEmailSignupIn, request: Request, db: DbSession):
    ip = _client_ip(request)
    now = datetime.now(timezone.utc)
    attempts = await db.scalar(
        select(func.count(AuditEvent.id)).where(
            AuditEvent.action == "portal.signup_failed",
            AuditEvent.ip_address == ip,
            AuditEvent.occurred_at >= now - timedelta(minutes=15),
        )
    )
    if (attempts or 0) >= 10:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Try again in 15 minutes.")

    matches = list((await db.scalars(
        select(Patient)
        .join(Course, Course.id == Patient.course_id)
        .where(
            func.lower(Patient.portal_email) == body.email,
            Patient.mode.in_(("practice", "assessment")),
            Patient.deleted_at.is_(None),
            Course.status == "active",
        )
        .limit(2)
        .with_for_update(of=Patient)
    )).all())
    if len(matches) > 1:
        raise HTTPException(status.HTTP_409_CONFLICT, "More than one chart is registered to this email. Contact your administrator.")
    if await get_user_by_email(db, body.email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This email already belongs to an account.")

    if not matches:
        try:
            person = await create_unlinked_patient_user(db, email=body.email, password=body.password)
        except IntegrityError:
            await db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "This email already belongs to an account.")
        person.last_login_at = now
        await log_event(
            db,
            action="portal.signup",
            entity_type="user",
            actor_user_id=person.id,
            entity_id=str(person.id),
            ip_address=ip,
            detail="Created patient login without a linked chart.",
        )
        token = await _token_for(db, person)
        await db.commit()
        return token

    patient = matches[0]
    course = await db.get(Course, patient.course_id)
    try:
        ensure_chart_eligible(patient, course)
    except HTTPException:
        await log_event(db, action="portal.signup_failed", entity_type="patient", ip_address=ip)
        await db.commit()
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No patient chart found for that email. Contact your administrator.",
        )
    if await chart_is_claimed(db, patient.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "A portal account already exists for this chart.")

    try:
        person = await create_patient_user(
            db, patient, email=body.email, password=body.password, must_change_password=False
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This email already belongs to an account.")
    person.last_login_at = now
    await log_event(
        db,
        action="portal.signup",
        entity_type="patient",
        actor_user_id=person.id,
        entity_id=str(patient.id),
        course_id=patient.course_id,
        ip_address=ip,
    )
    token = await _token_for(db, person)
    await db.commit()
    return token


@router.post("/refresh", response_model=Token)
async def refresh(body: RefreshRequest, db: DbSession):
    row = await rotate_refresh_token(db, body.refresh_token)
    user = await get_user_by_id(db, row.user_id)
    if user is None or not is_usable(user):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in again.")
    refresh_token = await issue_refresh_token(db, user.id, family_id=row.family_id)
    await db.commit()
    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=refresh_token,
        must_change_password=user.must_change_password,
        user=PublicUser.model_validate(await user_out(db, user)),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest, request: Request, db: DbSession):
    await revoke_refresh_token(db, body.refresh_token)
    await log_event(
        db,
        action="auth.logout",
        entity_type="user",
        ip_address=_client_ip(request),
    )
    await db.commit()


@router.get("/me", response_model=PublicUser, response_model_exclude_none=True)
async def me(user: UserAllowPwChange, db: DbSession):
    return await user_out(db, user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest, request: Request, user: UserAllowPwChange, db: DbSession
):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different")

    user.hashed_password = hash_password(body.new_password)
    user.must_change_password = False
    await log_event(
        db,
        action="auth.password_changed",
        entity_type="user",
        actor_user_id=user.id,
        entity_id=str(user.id),
        ip_address=_client_ip(request),
    )
    await db.commit()
