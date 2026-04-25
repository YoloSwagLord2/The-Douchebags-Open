"""Add username field to users table

Revision ID: 0002_add_username
Revises: 20260423_0001_initial_schema
Create Date: 2026-04-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002_add_username"
down_revision = "20260423_0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("username", sa.String(120), nullable=False, unique=True, index=True),
    )


def downgrade() -> None:
    op.drop_column("users", "username")
