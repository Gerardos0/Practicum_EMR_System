"""Match Sim Center bed counts to the beds drawn on the floor plan."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "sprint8_02_sim_lab_bed_counts"
down_revision: Union[str, Sequence[str], None] = "sprint8_01_sim_lab_checkin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    rooms = sa.table("sim_lab_rooms", sa.column("number", sa.String), sa.column("bed_count", sa.Integer))
    op.execute(rooms.update().where(rooms.c.number == "127").values(bed_count=1))
    op.execute(rooms.update().where(rooms.c.number == "103").values(bed_count=6))


def downgrade() -> None:
    rooms = sa.table("sim_lab_rooms", sa.column("number", sa.String), sa.column("bed_count", sa.Integer))
    op.execute(rooms.update().where(rooms.c.number == "127").values(bed_count=5))
    op.execute(rooms.update().where(rooms.c.number == "103").values(bed_count=5))
