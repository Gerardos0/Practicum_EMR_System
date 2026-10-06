import uuid
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select
from app.api.deps import CurrentUser, DbSession
from app.models.audit import AuditEvent
from app.models.user import User
from app.schemas.clinical import AuditOut
from app.services.access import full_name, memberships_for, require, require_course

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditOut], response_model_exclude_none=True)
async def list_audit(
    db: DbSession,
    user: CurrentUser,
    course_id: Annotated[uuid.UUID, Query()],
    role: Annotated[str, Query()],
):
    rows = await memberships_for(db, user.id)
    require_course(role, course_id, user, rows)
    require(role, "audit:view", "Your role can't view the audit log.")
    events = (
        await db.scalars(
            select(AuditEvent).where(AuditEvent.course_id == course_id).order_by(AuditEvent.occurred_at.desc())
        )
    ).all()
    payload = []
    for event in events:
        actor = await db.get(User, event.actor_user_id) if event.actor_user_id else None
        entity = event.entity_type if not event.entity_id else f"{event.entity_type}/{event.entity_id}"
        detail = (event.details or {}).get("detail")
        payload.append(
            {
                "id": str(event.id),
                "timestamp": event.occurred_at,
                "actor_id": str(event.actor_user_id) if event.actor_user_id else "",
                "actor_name": full_name(actor) if actor else "Unknown",
                "action": event.action,
                "entity": entity,
                "result": event.result,
                "detail": detail,
            }
        )
    return payload
