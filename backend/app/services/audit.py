"""FR-05: one place every module calls to record who did what, when.
Does NOT commit -- the caller commits, so the audit row and the change it
describes are saved together or not at all."""
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditEvent


async def log_event(
    db: AsyncSession,
    *,
    action: str,
    entity_type: str,
    actor_user_id: uuid.UUID | None = None,
    entity_id: str | None = None,
    ip_address: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditEvent(
            action=action,
            entity_type=entity_type,
            actor_user_id=actor_user_id,
            entity_id=entity_id,
            ip_address=ip_address,
            details=details,
        )
    )
