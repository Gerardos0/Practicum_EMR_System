"""Shared FastAPI dependencies. Every protected route uses one of these, so
authorization is enforced server-side (FR-03, NFR-04)."""
import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.services.auth import get_user_by_id, is_usable, permission_codes

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user_allow_password_change(
    db: DbSession, token: Annotated[str, Depends(oauth2_scheme)]
) -> User:
    """Valid token + active user. Does NOT block temp-password users --
    only used by /me and /change-password."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    sub = decode_access_token(token)
    if sub is None:
        raise unauthorized
    try:
        user_id = uuid.UUID(sub)
    except ValueError:
        raise unauthorized
    user = await get_user_by_id(db, user_id)
    if user is None or not is_usable(user):
        raise unauthorized
    return user


async def get_current_user(
    user: Annotated[User, Depends(get_current_user_allow_password_change)],
) -> User:
    """Default for protected routes: also blocks users still on a temp password (FR-08)."""
    if user.must_change_password:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password change required")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_permission(code: str):
    """Usage: user: Annotated[User, Depends(require_permission("patient:read"))]"""

    async def checker(user: CurrentUser) -> User:
        if code not in permission_codes(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing permission: {code}")
        return user

    return checker
