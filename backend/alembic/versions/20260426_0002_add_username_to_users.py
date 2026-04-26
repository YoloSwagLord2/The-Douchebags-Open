"""Add username field to users table

Revision ID: 0002_add_username
Revises: 20260423_0001_initial_schema
Create Date: 2026-04-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002_add_username"
down_revision = "20260423_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add nullable first to handle existing rows
    op.add_column("users", sa.Column("username", sa.String(120), nullable=True))
    # Backfill existing users: derive username from the part before @ in email
    op.execute("UPDATE users SET username = split_part(email, '@', 1) WHERE username IS NULL")
    # Now enforce NOT NULL and unique
    op.alter_column("users", "username", nullable=False)
    op.create_unique_constraint("uq_users_username", "users", ["username"])
    op.create_index("ix_users_username", "users", ["username"])


def downgrade() -> None:
    op.drop_column("users", "username")
