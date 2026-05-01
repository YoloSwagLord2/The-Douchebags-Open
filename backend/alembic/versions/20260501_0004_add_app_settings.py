"""Add app settings table

Revision ID: 0004_add_app_settings
Revises: 0003_add_hole_image
Create Date: 2026-05-01

"""
from alembic import op
import sqlalchemy as sa


revision = "0004_add_app_settings"
down_revision = "0003_add_hole_image"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if _table_exists("app_settings"):
        return

    op.create_table(
        "app_settings",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("key", sa.String(120), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    if _table_exists("app_settings"):
        op.drop_table("app_settings")
