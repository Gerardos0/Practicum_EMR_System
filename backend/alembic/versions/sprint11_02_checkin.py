"""Record who checked a visit in."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "sprint11_02_checkin"
down_revision: Union[str, Sequence[str], None] = "sprint11_01_visits"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("encounters", sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("encounters", sa.Column("checked_in_by_id", sa.Uuid(), nullable=True))
    op.add_column("encounters", sa.Column("checked_in_by_name", sa.String(length=120), nullable=True))
    op.create_foreign_key(
        "fk_encounters_checked_in_by_id_users",
        "encounters",
        "users",
        ["checked_in_by_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_encounters_checked_in_by_id_users", "encounters", type_="foreignkey")
    op.drop_column("encounters", "checked_in_by_name")
    op.drop_column("encounters", "checked_in_by_id")
    op.drop_column("encounters", "checked_in_at")
