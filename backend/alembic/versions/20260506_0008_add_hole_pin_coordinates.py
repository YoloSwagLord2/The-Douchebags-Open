"""add hole pin coordinates

Revision ID: 0008_hole_pin_coords
Revises: 0007_player_profile
Create Date: 2026-05-06
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_hole_pin_coords"
down_revision = "0007_player_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("holes", sa.Column("pin_lat", sa.Float(), nullable=True))
    op.add_column("holes", sa.Column("pin_lng", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("holes", "pin_lng")
    op.drop_column("holes", "pin_lat")
