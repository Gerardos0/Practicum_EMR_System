from datetime import datetime
from typing import Literal

from pydantic import ConfigDict, Field, field_validator, model_validator

from app.schemas.common import APIModel
from app.services.portal_accounts import USERNAME_RE, normalize_code


class PatientSignupIn(APIModel):
    model_config = ConfigDict(**APIModel.model_config, extra="forbid", str_strip_whitespace=True)

    code: str = Field(min_length=8, max_length=16)
    username: str = Field(min_length=4, max_length=30)
    password: str = Field(min_length=10, max_length=128)

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        value = normalize_code(value)
        if len(value) != 8:
            raise ValueError("Activation code must contain 8 characters.")
        return value

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = value.lower()
        if USERNAME_RE.fullmatch(value) is None:
            raise ValueError("Username must be 4–30 lowercase letters, numbers, dots, dashes or underscores and start with a letter or number.")
        return value

    @model_validator(mode="after")
    def password_differs_from_username(self):
        if self.password.lower() == self.username:
            raise ValueError("Password cannot be the same as the username.")
        return self


class PortalInviteOut(APIModel):
    code: str
    expires_at: datetime


class ProvisionRequest(APIModel):
    dry_run: bool = True
    modes: list[Literal["practice", "assessment"]] = Field(default_factory=lambda: ["practice", "assessment"], min_length=1)
    course_code: str | None = None
    limit: int = Field(default=500, ge=1, le=500)


class ProvisionRowOut(APIModel):
    username: str
    temporary_password: str | None = None
    patient_name: str
    mrn: str
    course_code: str
    mode: str


class ProvisionResultOut(APIModel):
    eligible: int
    created: int
    skipped_claimed: int
    skipped_case_masters: int
    skipped_inactive_course: int
    remaining: int
    rows: list[ProvisionRowOut] = Field(default_factory=list)
