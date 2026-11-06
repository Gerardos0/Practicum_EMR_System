from datetime import date, datetime
from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from app.schemas.common import APIModel


class IntakeData(APIModel):
    model_config = APIModel.model_config | ConfigDict(extra="forbid")

    preferred_name: str = Field(default="", max_length=100)
    pronouns: str = Field(default="", max_length=40)
    phone: str = Field(default="", max_length=40)
    address: str = Field(default="", max_length=300)
    preferred_language: str = Field(default="", max_length=60)
    past_medical_history: str = Field(default="", max_length=4000)
    surgical_history: str = Field(default="", max_length=4000)
    family_history: str = Field(default="", max_length=4000)
    social_history: str = Field(default="", max_length=4000)
    insurance_payer: str = Field(default="", max_length=120)
    insurance_member_id: str = Field(default="", max_length=60)
    insurance_group_number: str = Field(default="", max_length=60)
    emergency_contact_name: str = Field(default="", max_length=120)
    emergency_contact_phone: str = Field(default="", max_length=40)
    emergency_contact_relationship: str = Field(default="", max_length=60)

    @field_validator("*", mode="before")
    @classmethod
    def strip_whitespace(cls, value):
        return value.strip() if isinstance(value, str) else value


class IntakeIdentity(APIModel):
    first_name: str
    last_name: str
    dob: date
    sex_at_birth: str
    mrn: str


class PortalIntakeOut(APIModel):
    data: IntakeData
    identity: IntakeIdentity
    source: Literal["chart", "patient"]
    updated_at: datetime | None = None
    editable: bool
    not_editable_reason: str | None = None


class StaffIntakeOut(APIModel):
    submitted: bool
    data: IntakeData | None = None
    updated_at: datetime | None = None
