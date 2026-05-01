"""Add image_path field to holes table

Revision ID: 0003_add_hole_image
Revises: 0002_add_username
Create Date: 2026-04-26

"""
from alembic import op
import sqlalchemy as sa


revision = "0003_add_hole_image"
down_revision = "0002_add_username"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("holes", sa.Column("image_path", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("holes", "image_path")
