"""Give room 127 the five beds drawn on the floor plan."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "sprint11_03_room_127_beds"
down_revision: Union[str, Sequence[str], None] = "sprint11_02_checkin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    rooms = sa.table("sim_lab_rooms", sa.column("number", sa.String), sa.column("bed_count", sa.Integer))
    op.execute(rooms.update().where(rooms.c.number == "127").values(bed_count=5))


def downgrade() -> None:
    rooms = sa.table("sim_lab_rooms", sa.column("number", sa.String), sa.column("bed_count", sa.Integer))
    op.execute(rooms.update().where(rooms.c.number == "127").values(bed_count=1))
