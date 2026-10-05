from pydantic import Field

from app.schemas.clinical import PublicUser
from app.schemas.common import APIModel


class Token(APIModel):
    access_token: str = Field(serialization_alias="access_token")
    token_type: str = Field(default="bearer", serialization_alias="token_type")
    must_change_password: bool
    user: PublicUser


class ChangePasswordRequest(APIModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
