"""Store a contact email on patient charts for email-based portal signup."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "sprint5_04_patient_portal_email"
down_revision: Union[str, Sequence[str], None] = "sprint5_03_portal_invites"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("patients", sa.Column("portal_email", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("patients", "portal_email")
