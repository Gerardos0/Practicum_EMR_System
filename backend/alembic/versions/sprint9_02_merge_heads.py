"""Join the bed-count and session-activity branches."""
from typing import Sequence, Union

revision: str = "sprint9_02_merge_heads"
down_revision: Union[str, Sequence[str], None] = (
    "sprint8_02_sim_lab_bed_counts",
    "sprint9_01_session_activity",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
