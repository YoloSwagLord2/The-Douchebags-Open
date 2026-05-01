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


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _index_exists(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def _unique_exists(table_name: str, columns: list[str]) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(constraint.get("column_names") == columns for constraint in inspector.get_unique_constraints(table_name))


def upgrade() -> None:
    # Add nullable first to handle existing rows
    if not _column_exists("users", "username"):
        op.add_column("users", sa.Column("username", sa.String(120), nullable=True))
    # Backfill existing users: derive username from the part before @ in email
    op.execute("UPDATE users SET username = split_part(email, '@', 1) WHERE username IS NULL")
    # Now enforce NOT NULL and unique
    op.alter_column("users", "username", nullable=False)
    if not _unique_exists("users", ["username"]):
        op.create_unique_constraint("uq_users_username", "users", ["username"])
    if not _index_exists("users", "ix_users_username"):
        op.create_index("ix_users_username", "users", ["username"])


def downgrade() -> None:
    if _column_exists("users", "username"):
        op.drop_column("users", "username")
