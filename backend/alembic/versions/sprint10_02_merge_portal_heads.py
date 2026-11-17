"""Join the duplicate portal-account migration merge revisions."""
from typing import Sequence, Union

revision: str = "sprint10_02_merge_portal_heads"
down_revision: Union[str, Sequence[str], None] = (
    "sprint9_03_merge_portal_accounts",
    "sprint10_01_merge_accounts",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
