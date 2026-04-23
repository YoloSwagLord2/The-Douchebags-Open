"""Initial schema

Revision ID: 20260423_0001
Revises:
Create Date: 2026-04-23 22:00:00
"""

from alembic import op

from app.db.base import Base

# revision identifiers, used by Alembic.
revision = "20260423_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
