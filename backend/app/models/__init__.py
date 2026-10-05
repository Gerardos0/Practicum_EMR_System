# Import every model here so Alembic autogenerate can see them.
from app.models.audit import AuditEvent  # noqa: F401
from app.models.clinical import (  # noqa: F401
    Allergy,
    Appointment,
    ClinicalNote,
    Course,
    CourseMembership,
    Encounter,
    LabResult,
    Medication,
    NoteAddendum,
    NoteComment,
    Patient,
    Problem,
    Referral,
    Vital,
)
from app.models.user import Discipline, Permission, Role, User  # noqa: F401