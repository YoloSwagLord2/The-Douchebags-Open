"""Add round names and round rosters

Revision ID: 0005_round_names_rosters
Revises: 0004_add_app_settings
Create Date: 2026-05-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0005_round_names_rosters"
down_revision = "0004_add_app_settings"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _column_exists("rounds", "name"):
        op.add_column("rounds", sa.Column("name", sa.String(160), nullable=True))

    if not _table_exists("round_players"):
        op.create_table(
            "round_players",
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("round_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("player_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.ForeignKeyConstraint(["player_id"], ["users.id"], name="fk_round_players_player_id_users"),
            sa.ForeignKeyConstraint(["round_id"], ["rounds.id"], name="fk_round_players_round_id_rounds", ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id", name="pk_round_players"),
            sa.UniqueConstraint("round_id", "player_id", name="uq_round_players_pair"),
        )


def downgrade() -> None:
    if _table_exists("round_players"):
        op.drop_table("round_players")
    if _column_exists("rounds", "name"):
        op.drop_column("rounds", "name")
