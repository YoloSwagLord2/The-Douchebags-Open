"""Add player gallery media

Revision ID: 0006_gallery_media
Revises: 0005_round_names_rosters
Create Date: 2026-05-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0006_gallery_media"
down_revision = "0005_round_names_rosters"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _enum_exists(enum_name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = :name"), {"name": enum_name}).scalar())


def upgrade() -> None:
    if not _enum_exists("gallery_media_type"):
        sa.Enum("photo", "video", name="gallery_media_type").create(op.get_bind())

    if not _table_exists("gallery_media"):
        op.create_table(
            "gallery_media",
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("uploader_user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("round_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("hole_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("media_type", sa.Enum("photo", "video", name="gallery_media_type", create_type=False), nullable=False),
            sa.Column("original_path", sa.String(255), nullable=False),
            sa.Column("display_path", sa.String(255), nullable=False),
            sa.Column("thumbnail_path", sa.String(255), nullable=True),
            sa.Column("caption", sa.String(280), nullable=True),
            sa.Column("duration_seconds", sa.Integer(), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.ForeignKeyConstraint(["deleted_by_user_id"], ["users.id"], name="fk_gallery_media_deleted_by_user_id_users"),
            sa.ForeignKeyConstraint(["hole_id"], ["holes.id"], name="fk_gallery_media_hole_id_holes"),
            sa.ForeignKeyConstraint(["round_id"], ["rounds.id"], name="fk_gallery_media_round_id_rounds", ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["uploader_user_id"], ["users.id"], name="fk_gallery_media_uploader_user_id_users"),
            sa.PrimaryKeyConstraint("id", name="pk_gallery_media"),
        )
        op.create_index("ix_gallery_media_created_at", "gallery_media", ["created_at"])
        op.create_index("ix_gallery_media_round_id", "gallery_media", ["round_id"])

    if not _table_exists("gallery_media_likes"):
        op.create_table(
            "gallery_media_likes",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("media_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["media_id"], ["gallery_media.id"], name="fk_gallery_media_likes_media_id_gallery_media", ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_gallery_media_likes_user_id_users"),
            sa.PrimaryKeyConstraint("id", name="pk_gallery_media_likes"),
            sa.UniqueConstraint("media_id", "user_id", name="uq_gallery_media_likes_pair"),
        )

    if not _table_exists("gallery_media_comments"):
        op.create_table(
            "gallery_media_comments",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("media_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.ForeignKeyConstraint(["deleted_by_user_id"], ["users.id"], name="fk_gallery_media_comments_deleted_by_user_id_users"),
            sa.ForeignKeyConstraint(["media_id"], ["gallery_media.id"], name="fk_gallery_media_comments_media_id_gallery_media", ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_gallery_media_comments_user_id_users"),
            sa.PrimaryKeyConstraint("id", name="pk_gallery_media_comments"),
        )
        op.create_index("ix_gallery_media_comments_media_created", "gallery_media_comments", ["media_id", "created_at"])


def downgrade() -> None:
    if _table_exists("gallery_media_comments"):
        op.drop_index("ix_gallery_media_comments_media_created", table_name="gallery_media_comments")
        op.drop_table("gallery_media_comments")
    if _table_exists("gallery_media_likes"):
        op.drop_table("gallery_media_likes")
    if _table_exists("gallery_media"):
        op.drop_index("ix_gallery_media_round_id", table_name="gallery_media")
        op.drop_index("ix_gallery_media_created_at", table_name="gallery_media")
        op.drop_table("gallery_media")
    if _enum_exists("gallery_media_type"):
        sa.Enum("photo", "video", name="gallery_media_type").drop(op.get_bind())
