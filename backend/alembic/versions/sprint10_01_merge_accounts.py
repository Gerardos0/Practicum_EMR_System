"""Join the patient-account branch with the current Sim Center head."""
from typing import Sequence, Union

revision: str = "sprint10_01_merge_accounts"
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
