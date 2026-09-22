"""FR-05 / NFR-05: append-only audit trail. No updated_at, no soft delete --
rows are only ever inserted. (Later: revoke UPDATE/DELETE at the DB role level.)"""
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(50))        # "patient.view", "note.sign", "auth.login"
    entity_type: Mapped[str] = mapped_column(String(50))   # "patient", "note", ...
    entity_id: Mapped[str | None] = mapped_column(String(64))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
