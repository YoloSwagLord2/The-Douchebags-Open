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


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _column_exists("holes", "image_path"):
        op.add_column("holes", sa.Column("image_path", sa.String(255), nullable=True))


def downgrade() -> None:
    if _column_exists("holes", "image_path"):
        op.drop_column("holes", "image_path")
