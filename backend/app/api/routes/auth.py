from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import DbSession, get_current_user_allow_password_change
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
import re

from app.schemas.auth import ChangePasswordRequest, Token
from app.schemas.clinical import PublicUser
from app.services.audit import log_event
from app.services.auth import authenticate_user
from app.services.serialize import user_out

UTEP_EMAIL = re.compile(r"@(miners\.)?utep\.edu$", re.IGNORECASE)

router = APIRouter(prefix="/auth", tags=["auth"])

UserAllowPwChange = Annotated[User, Depends(get_current_user_allow_password_change)]


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],  # "username" field = email
    db: DbSession,
):
    email = form.username.strip()
    if not UTEP_EMAIL.search(email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Use your UTEP email address (@utep.edu or @miners.utep.edu).")
    user = await authenticate_user(db, email, form.password)
    if user is None:
        await log_event(
            db,
            action="auth.login_failed",
            entity_type="user",
            ip_address=_client_ip(request),
            details={"email": form.username.strip().lower()},
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user.last_login_at = datetime.now(timezone.utc)
    await log_event(
        db,
        action="auth.login",
        entity_type="user",
        actor_user_id=user.id,
        entity_id=str(user.id),
        ip_address=_client_ip(request),
    )
    await db.commit()
    return Token(
        access_token=create_access_token(str(user.id)),
        must_change_password=user.must_change_password,
        user=PublicUser.model_validate(await user_out(db, user)),
    )


@router.post("/refresh", response_model=Token)
async def refresh(user: UserAllowPwChange, db: DbSession):
    return Token(
        access_token=create_access_token(str(user.id)),
        must_change_password=user.must_change_password,
        user=PublicUser.model_validate(await user_out(db, user)),
    )


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
