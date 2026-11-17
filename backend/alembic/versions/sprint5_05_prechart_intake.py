"""Allow patients without charts to submit intake information."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "sprint5_05_prechart_intake"
down_revision: Union[str, Sequence[str], None] = "sprint5_04_patient_portal_email"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("patient_intakes", "patient_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.add_column("patient_intakes", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_patient_intakes_user_id_users", "patient_intakes", "users", ["user_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_patient_intakes_user_id", "patient_intakes", ["user_id"], unique=True)
    op.create_check_constraint(
        "ck_patient_intakes_owner",
        "patient_intakes",
        "(patient_id IS NOT NULL AND user_id IS NULL) OR (patient_id IS NULL AND user_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.execute("DELETE FROM patient_intakes WHERE patient_id IS NULL")
    op.drop_constraint("ck_patient_intakes_owner", "patient_intakes", type_="check")
    op.drop_index("ix_patient_intakes_user_id", table_name="patient_intakes")
    op.drop_constraint("fk_patient_intakes_user_id_users", "patient_intakes", type_="foreignkey")
    op.drop_column("patient_intakes", "user_id")
    op.alter_column("patient_intakes", "patient_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
