import uuid

from pydantic import BaseModel


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    discipline: str | None
    must_change_password: bool
    roles: list[str]
    permissions: list[str]
