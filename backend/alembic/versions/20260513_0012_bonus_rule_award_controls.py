"""Add bonus rule award controls

Revision ID: 0012_bonus_controls
Revises: 0011_bonus_occurrence
Create Date: 2026-05-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0012_bonus_controls"
down_revision = "0011_bonus_occurrence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE bonus_award_timing AS ENUM ('live', 'round_close')")
    op.execute(
        "CREATE TYPE bonus_repeat_limit AS ENUM ("
        "'every_qualifying_event', "
        "'one_batch_until_reset', "
        "'once_per_player_until_reset', "
        "'once_per_player_per_round'"
        ")"
    )
    op.execute(
        "CREATE TYPE bonus_winner_selection AS ENUM ("
        "'all_matching', 'top_x', 'bottom_x', 'top_half', 'bottom_half'"
        ")"
    )
    op.execute("CREATE TYPE bonus_award_timing_snapshot AS ENUM ('live', 'round_close')")

    op.add_column(
        "bonus_rules",
        sa.Column(
            "award_timing",
            postgresql.ENUM("live", "round_close", name="bonus_award_timing", create_type=False),
            nullable=False,
            server_default="live",
        ),
    )
    op.add_column(
        "bonus_rules",
        sa.Column(
            "repeat_limit",
            postgresql.ENUM(
                "every_qualifying_event",
                "one_batch_until_reset",
                "once_per_player_until_reset",
                "once_per_player_per_round",
                name="bonus_repeat_limit",
                create_type=False,
            ),
            nullable=False,
            server_default="every_qualifying_event",
        ),
    )
    op.add_column(
        "bonus_rules",
        sa.Column(
            "winner_selection",
            postgresql.ENUM(
                "all_matching",
                "top_x",
                "bottom_x",
                "top_half",
                "bottom_half",
                name="bonus_winner_selection",
                create_type=False,
            ),
            nullable=False,
            server_default="all_matching",
        ),
    )
    op.add_column("bonus_rules", sa.Column("winner_selection_count", sa.Integer(), nullable=True))
    op.add_column("bonus_rules", sa.Column("reset_cycle", sa.Integer(), nullable=False, server_default="1"))

    op.add_column("bonus_awards", sa.Column("round_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("bonus_awards", sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("bonus_awards", sa.Column("logical_key", sa.String(length=255), nullable=True))
    op.add_column("bonus_awards", sa.Column("reset_cycle", sa.Integer(), nullable=False, server_default="1"))
    op.add_column(
        "bonus_awards",
        sa.Column(
            "award_timing_snapshot",
            postgresql.ENUM("live", "round_close", name="bonus_award_timing_snapshot", create_type=False),
            nullable=False,
            server_default="live",
        ),
    )

    op.execute("UPDATE bonus_awards SET logical_key = 'live:rule:' || bonus_rule_id::text || ':revision:' || occurrence_key || ':cycle:1'")
    op.alter_column("bonus_awards", "logical_key", nullable=False)
    op.alter_column("bonus_awards", "trigger_score_revision_id", nullable=True)

    op.create_foreign_key("fk_bonus_awards_round_id_rounds", "bonus_awards", "rounds", ["round_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key(
        "fk_bonus_awards_tournament_id_tournaments",
        "bonus_awards",
        "tournaments",
        ["tournament_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_bonus_awards_rule_logical_cycle", "bonus_awards", ["bonus_rule_id", "logical_key", "reset_cycle"])
    op.create_index("ix_bonus_awards_player_round", "bonus_awards", ["player_id", "round_id"])

    op.alter_column("bonus_rules", "award_timing", server_default=None)
    op.alter_column("bonus_rules", "repeat_limit", server_default=None)
    op.alter_column("bonus_rules", "winner_selection", server_default=None)
    op.alter_column("bonus_rules", "reset_cycle", server_default=None)
    op.alter_column("bonus_awards", "reset_cycle", server_default=None)
    op.alter_column("bonus_awards", "award_timing_snapshot", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_bonus_awards_player_round", table_name="bonus_awards")
    op.drop_index("ix_bonus_awards_rule_logical_cycle", table_name="bonus_awards")
    op.drop_constraint("fk_bonus_awards_tournament_id_tournaments", "bonus_awards", type_="foreignkey")
    op.drop_constraint("fk_bonus_awards_round_id_rounds", "bonus_awards", type_="foreignkey")
    op.alter_column("bonus_awards", "trigger_score_revision_id", nullable=False)
    op.drop_column("bonus_awards", "award_timing_snapshot")
    op.drop_column("bonus_awards", "reset_cycle")
    op.drop_column("bonus_awards", "logical_key")
    op.drop_column("bonus_awards", "tournament_id")
    op.drop_column("bonus_awards", "round_id")
    op.drop_column("bonus_rules", "reset_cycle")
    op.drop_column("bonus_rules", "winner_selection_count")
    op.drop_column("bonus_rules", "winner_selection")
    op.drop_column("bonus_rules", "repeat_limit")
    op.drop_column("bonus_rules", "award_timing")
    op.execute("DROP TYPE bonus_award_timing_snapshot")
    op.execute("DROP TYPE bonus_winner_selection")
    op.execute("DROP TYPE bonus_repeat_limit")
    op.execute("DROP TYPE bonus_award_timing")
