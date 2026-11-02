"""Program accounts stay until an administrator archives them. Records are kept two years."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.clinical import ClinicalNote, NoteAddendum, NoteComment
from app.models.user import User
from app.services.charts import utcnow

RETENTION = timedelta(days=365 * 2)


def retention_ends(archived_at: datetime) -> datetime:
    value = archived_at if archived_at.tzinfo else archived_at.replace(tzinfo=timezone.utc)
    return value + RETENTION


async def purge_expired(db: AsyncSession) -> int:
    cutoff = utcnow() - RETENTION
    users = list(
        (
            await db.scalars(
                select(User).where(User.archived_at.is_not(None), User.archived_at <= cutoff, User.purged_at.is_(None))
            )
        ).all()
    )
    for user in users:
        note_ids = list(
            (await db.scalars(select(ClinicalNote.id).where(ClinicalNote.author_id == user.id))).all()
        )
        if note_ids:
            await db.execute(NoteComment.__table__.delete().where(NoteComment.note_id.in_(note_ids)))
            await db.execute(NoteAddendum.__table__.delete().where(NoteAddendum.note_id.in_(note_ids)))
            await db.execute(ClinicalNote.__table__.delete().where(ClinicalNote.id.in_(note_ids)))
        await db.execute(NoteComment.__table__.delete().where(NoteComment.author_id == user.id))
        await db.execute(NoteAddendum.__table__.delete().where(NoteAddendum.author_id == user.id))
        user.first_name = "Archived"
        user.last_name = "Student"
        user.email = f"archived-{user.id}@invalid.local"
        user.university_id = None
        user.phone_last4 = None
        user.hashed_password = hash_password(str(user.id))
        user.is_active = False
        user.purged_at = utcnow()
    return len(users)
