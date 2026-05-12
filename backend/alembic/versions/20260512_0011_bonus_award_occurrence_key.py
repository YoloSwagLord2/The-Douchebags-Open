"""Add bonus award occurrence keys

Revision ID: 0011_bonus_occurrence
Revises: 0010_lock_hcp
Create Date: 2026-05-12
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_bonus_occurrence"
down_revision = "0010_lock_hcp"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bonus_awards", sa.Column("occurrence_key", sa.String(length=160), nullable=True))
    op.execute("UPDATE bonus_awards SET occurrence_key = trigger_score_revision_id::text WHERE occurrence_key IS NULL")
    op.alter_column("bonus_awards", "occurrence_key", nullable=False)
    op.create_index("ix_bonus_awards_rule_occurrence", "bonus_awards", ["bonus_rule_id", "occurrence_key"])


def downgrade() -> None:
    op.drop_index("ix_bonus_awards_rule_occurrence", table_name="bonus_awards")
    op.drop_column("bonus_awards", "occurrence_key")
