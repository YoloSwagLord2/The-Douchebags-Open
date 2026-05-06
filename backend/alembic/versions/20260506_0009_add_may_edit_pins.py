"""add may_edit_pins to users

Revision ID: 0009_may_edit_pins
Revises: 0008_hole_pin_coords
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_may_edit_pins"
down_revision = "0008_hole_pin_coords"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("may_edit_pins", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("users", "may_edit_pins")
