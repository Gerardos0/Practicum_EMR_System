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
    result: str = "ok",
    course_id: uuid.UUID | None = None,
    detail: str | None = None,
) -> None:
    payload = dict(details or {})
    if detail:
        payload["detail"] = detail
    db.add(
        AuditEvent(
            action=action,
            entity_type=entity_type,
            actor_user_id=actor_user_id,
            entity_id=entity_id,
            ip_address=ip_address,
            details=payload or None,
            result=result,
            course_id=course_id,
        )
    )
