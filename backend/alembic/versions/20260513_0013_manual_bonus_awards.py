"""Allow manual bonus awards

Revision ID: 0013_manual_bonus_awards
Revises: 0012_bonus_controls
Create Date: 2026-05-13
"""

from alembic import op
import sqlalchemy as sa


revision = "0013_manual_bonus_awards"
down_revision = "0012_bonus_controls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bonus_awards", sa.Column("manual_title", sa.String(length=160), nullable=True))
    op.alter_column("bonus_awards", "bonus_rule_id", nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM bonus_awards WHERE bonus_rule_id IS NULL")
    op.alter_column("bonus_awards", "bonus_rule_id", nullable=False)
    op.drop_column("bonus_awards", "manual_title")
