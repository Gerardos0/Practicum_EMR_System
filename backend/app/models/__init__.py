# Import every model here so Alembic autogenerate can see them.
from app.models.audit import AuditEvent  # noqa: F401
from app.models.clinical import (  # noqa: F401
    Allergy,
    Appointment,
    CaseAnswerKey,
    ClinicalNote,
    Course,
    CourseMembership,
    Encounter,
    LabResult,
    ChartSession,
    Medication,
    MedicationAdministration,
    NoteAddendum,
    NoteComment,
    Patient,
    Problem,
    SavedNoteTemplate,
    Referral,
    Vital,
)
from app.models.user import Discipline, Permission, Role, User  # noqa: F401