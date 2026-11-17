"""Course track and pharmacy lab and procedure orders."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "sprint11_03_orders"
down_revision: Union[str, Sequence[str], None] = "sprint11_02_checkin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("track", sa.String(length=20), nullable=True))
    op.create_check_constraint("ck_courses_track", "courses", "track IS NULL OR track IN ('pharmacy', 'nursing')")
    op.execute("UPDATE courses SET track = 'pharmacy' WHERE upper(code) LIKE 'PHAR%'")
    op.execute("UPDATE courses SET track = 'nursing' WHERE upper(code) LIKE 'PHYT%'")
    op.execute(
        """
        UPDATE course_memberships AS membership
        SET discipline_id = nursing.id
        FROM disciplines AS nursing, disciplines AS therapy, courses, roles
        WHERE nursing.code = 'nursing'
          AND therapy.code = 'physical_therapy'
          AND membership.discipline_id = therapy.id
          AND membership.course_id = courses.id
          AND courses.track = 'nursing'
          AND membership.role_id = roles.id
          AND roles.code = 'student'
        """
    )
    op.create_table(
        "clinical_orders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("encounter_id", sa.Uuid(), nullable=True),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("priority", sa.String(length=20), server_default="routine", nullable=False),
        sa.Column("specimen", sa.String(length=80), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="ordered", nullable=False),
        sa.Column("ordered_by_id", sa.Uuid(), nullable=False),
        sa.Column("ordered_by_name", sa.String(length=120), nullable=False),
        sa.Column("ordered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("kind IN ('lab', 'procedure')", name="ck_clinical_orders_kind"),
        sa.CheckConstraint("priority IN ('routine', 'stat')", name="ck_clinical_orders_priority"),
        sa.CheckConstraint("status IN ('ordered', 'cancelled')", name="ck_clinical_orders_status"),
        sa.ForeignKeyConstraint(["encounter_id"], ["encounters.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["ordered_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_clinical_orders_patient_id", "clinical_orders", ["patient_id"])
    op.create_index("ix_clinical_orders_encounter_id", "clinical_orders", ["encounter_id"])


def downgrade() -> None:
    op.drop_index("ix_clinical_orders_encounter_id", table_name="clinical_orders")
    op.drop_index("ix_clinical_orders_patient_id", table_name="clinical_orders")
    op.drop_table("clinical_orders")
    op.drop_constraint("ck_courses_track", "courses", type_="check")
    op.drop_column("courses", "track")
