"""Multiple visits per chart, and instructor seats for coordinators."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "sprint11_01_visits"
down_revision: Union[str, Sequence[str], None] = "sprint10_02_merge_portal_heads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO user_roles (user_id, role_id)
        SELECT ur.user_id, instructor.id
        FROM user_roles ur
        JOIN roles coord ON coord.id = ur.role_id AND coord.code = 'course_coordinator'
        JOIN roles instructor ON instructor.code = 'instructor'
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO course_memberships (
            id, user_id, course_id, role_id, discipline_id, created_at, updated_at
        )
        SELECT gen_random_uuid(), cm.user_id, cm.course_id, instructor.id, cm.discipline_id, now(), now()
        FROM course_memberships cm
        JOIN roles coord ON coord.id = cm.role_id AND coord.code = 'course_coordinator'
        JOIN roles instructor ON instructor.code = 'instructor'
        WHERE NOT EXISTS (
            SELECT 1 FROM course_memberships existing
            WHERE existing.user_id = cm.user_id
              AND existing.course_id = cm.course_id
              AND existing.role_id = instructor.id
        )
        """
    )
    op.execute("UPDATE users SET acting_role = 'instructor' WHERE acting_role = 'course_coordinator'")

    op.add_column("encounters", sa.Column("status", sa.String(40), server_default="Scheduled", nullable=False))
    op.add_column("encounters", sa.Column("care_setting", sa.String(40), server_default="Outpatient", nullable=False))
    op.add_column("encounters", sa.Column("unit", sa.String(80), nullable=True))
    op.add_column("encounters", sa.Column("room", sa.String(40), nullable=True))
    op.add_column("encounters", sa.Column("bed", sa.String(40), nullable=True))
    op.add_column("encounters", sa.Column("chief_complaint", sa.Text(), server_default="", nullable=False))
    op.add_column("encounters", sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("encounters", sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(
        """
        UPDATE encounters AS visit
        SET status = patient.encounter_status,
            care_setting = patient.care_setting,
            unit = patient.unit,
            room = patient.room,
            bed = patient.bed,
            chief_complaint = patient.chief_complaint,
            opened_at = patient.created_at,
            closed_at = CASE
                WHEN patient.encounter_status IN ('Checked out', 'Closed') THEN patient.updated_at
                ELSE NULL
            END
        FROM patients AS patient
        WHERE visit.patient_id = patient.id
        """
    )
    op.drop_constraint("uq_encounters_patient_id", "encounters", type_="unique")
    op.create_index("ix_encounters_patient_id", "encounters", ["patient_id"])

    for table in ("vitals", "lab_results", "lung_sounds"):
        op.add_column(table, sa.Column("encounter_id", sa.Uuid(), nullable=True))
        op.create_index(f"ix_{table}_encounter_id", table, ["encounter_id"])
        op.create_foreign_key(
            f"fk_{table}_encounter_id_encounters",
            table,
            "encounters",
            ["encounter_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.execute(
            f"""
            UPDATE {table} AS row
            SET encounter_id = visit.id
            FROM encounters AS visit
            WHERE visit.patient_id = row.patient_id
              AND row.encounter_id IS NULL
            """
        )


def downgrade() -> None:
    for table in ("lung_sounds", "lab_results", "vitals"):
        op.drop_constraint(f"fk_{table}_encounter_id_encounters", table, type_="foreignkey")
        op.drop_index(f"ix_{table}_encounter_id", table_name=table)
        op.drop_column(table, "encounter_id")
    op.drop_index("ix_encounters_patient_id", table_name="encounters")
    op.create_unique_constraint("uq_encounters_patient_id", "encounters", ["patient_id"])
    for column in ("closed_at", "opened_at", "chief_complaint", "bed", "room", "unit", "care_setting", "status"):
        op.drop_column("encounters", column)
