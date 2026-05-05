"""Add age, signature_move, bio to users

Revision ID: 0007_player_profile
Revises: 0006_gallery_media
Create Date: 2026-05-05
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_player_profile"
down_revision = "0006_gallery_media"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("age", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("signature_move", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "bio")
    op.drop_column("users", "signature_move")
    op.drop_column("users", "age")
