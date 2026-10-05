from pydantic import Field

from app.schemas.clinical import PublicUser
from app.schemas.common import APIModel


class Token(APIModel):
    # OAuth field names stay snake_case. The nested user object is camelCase.
    access_token: str = Field(serialization_alias="access_token")
    token_type: str = Field(default="bearer", serialization_alias="token_type")
    must_change_password: bool  # frontend uses this to force the change-password screen (FR-08)
    user: PublicUser


class ChangePasswordRequest(APIModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
