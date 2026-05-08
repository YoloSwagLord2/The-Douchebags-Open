"""Lock hcp on tournament enrollment

Revision ID: 0010_lock_hcp
Revises: 0009_may_edit_pins
Create Date: 2026-05-08
"""

from alembic import op
import sqlalchemy as sa

revision = "0010_lock_hcp"
down_revision = "0009_may_edit_pins"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tournament_players", sa.Column("hcp", sa.Float(), nullable=True))
    op.execute(
        "UPDATE tournament_players tp SET hcp = u.hcp FROM users u WHERE tp.player_id = u.id"
    )


def downgrade() -> None:
    op.drop_column("tournament_players", "hcp")
