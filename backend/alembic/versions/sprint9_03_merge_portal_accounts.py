"""Join the patient account and main migration branches."""
from typing import Sequence, Union

revision: str = "sprint9_03_merge_portal_accounts"
down_revision: Union[str, Sequence[str], None] = (
    "sprint9_02_merge_heads",
    "sprint5_05_prechart_intake",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
