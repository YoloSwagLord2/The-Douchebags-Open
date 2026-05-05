import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import (
    AchievementIconPreset,
    BonusAnimationPreset,
    GalleryMediaType,
    NotificationPriority,
    NotificationSourceType,
    NotificationType,
    RoundStatus,
    ScopeType,
    ScoreChangeSource,
    UserRole,
)


def enum_column(enum_cls, name: str) -> Enum:
    return Enum(enum_cls, name=name, values_callable=lambda members: [member.value for member in members])


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    username: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    hcp: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False, default=0)
    role: Mapped[UserRole] = mapped_column(enum_column(UserRole, "user_role"), nullable=False, default=UserRole.PLAYER)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    photo_original_path: Mapped[str | None] = mapped_column(String(255))
    photo_avatar_path: Mapped[str | None] = mapped_column(String(255))
    photo_feature_path: Mapped[str | None] = mapped_column(String(255))
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    signature_move: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    scores: Mapped[list["Score"]] = relationship(back_populates="player", foreign_keys="Score.player_id")
    roster_entries: Mapped[list["TournamentPlayer"]] = relationship(back_populates="player")
    gallery_media: Mapped[list["GalleryMedia"]] = relationship(
        back_populates="uploader", foreign_keys="GalleryMedia.uploader_user_id"
    )
    gallery_likes: Mapped[list["GalleryMediaLike"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    gallery_comments: Mapped[list["GalleryMediaComment"]] = relationship(
        back_populates="user", foreign_keys="GalleryMediaComment.user_id"
    )

    __table_args__ = (CheckConstraint("hcp >= 0", name="hcp_nonnegative"),)


class Course(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "courses"

    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    slope_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    course_rating: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)

    holes: Mapped[list["Hole"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    rounds: Mapped[list["Round"]] = relationship(back_populates="course")


class Hole(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "holes"

    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"))
    hole_number: Mapped[int] = mapped_column(Integer, nullable=False)
    par: Mapped[int] = mapped_column(Integer, nullable=False)
    stroke_index: Mapped[int] = mapped_column(Integer, nullable=False)
    distance: Mapped[int] = mapped_column(Integer, nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(255))

    course: Mapped["Course"] = relationship(back_populates="holes")
    scores: Mapped[list["Score"]] = relationship(back_populates="hole")

    __table_args__ = (
        UniqueConstraint("course_id", "hole_number", name="uq_holes_course_id_hole_number"),
        UniqueConstraint("course_id", "stroke_index", name="uq_holes_course_id_stroke_index"),
    )

    @property
    def image_url(self) -> str | None:
        return f"/media/{self.image_path}" if self.image_path else None


class AppSetting(TimestampMixin, Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class Tournament(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tournaments"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)

    rounds: Mapped[list["Round"]] = relationship(back_populates="tournament", cascade="all, delete-orphan")
    players: Mapped[list["TournamentPlayer"]] = relationship(back_populates="tournament", cascade="all, delete-orphan")

    @property
    def player_ids(self) -> list[uuid.UUID]:
        return [tp.player_id for tp in self.players]


class Round(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "rounds"

    tournament_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"))
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id"))
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str | None] = mapped_column(String(160))
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[RoundStatus] = mapped_column(
        enum_column(RoundStatus, "round_status"), nullable=False, default=RoundStatus.OPEN
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tournament: Mapped["Tournament"] = relationship(back_populates="rounds")
    course: Mapped["Course"] = relationship(back_populates="rounds")
    players: Mapped[list["RoundPlayer"]] = relationship(back_populates="round", cascade="all, delete-orphan")
    scores: Mapped[list["Score"]] = relationship(back_populates="round", cascade="all, delete-orphan")
    gallery_media: Mapped[list["GalleryMedia"]] = relationship(back_populates="round", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("tournament_id", "round_number", name="uq_rounds_tournament_round_number"),)

    @property
    def player_ids(self) -> list[uuid.UUID]:
        return [rp.player_id for rp in self.players]


class TournamentPlayer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tournament_players"

    tournament_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"))
    player_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    tournament: Mapped["Tournament"] = relationship(back_populates="players")
    player: Mapped["User"] = relationship(back_populates="roster_entries")

    __table_args__ = (UniqueConstraint("tournament_id", "player_id", name="uq_tournament_players_pair"),)


class RoundPlayer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "round_players"

    round_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="CASCADE"))
    player_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    round: Mapped["Round"] = relationship(back_populates="players")
    player: Mapped["User"] = relationship()

    __table_args__ = (UniqueConstraint("round_id", "player_id", name="uq_round_players_pair"),)


class Score(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scores"

    round_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="CASCADE"))
    player_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    hole_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("holes.id"))
    strokes: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    round: Mapped["Round"] = relationship(back_populates="scores")
    player: Mapped["User"] = relationship(back_populates="scores", foreign_keys=[player_id])
    hole: Mapped["Hole"] = relationship(back_populates="scores")
    revisions: Mapped[list["ScoreRevision"]] = relationship(back_populates="score", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("round_id", "player_id", "hole_id", name="uq_scores_round_player_hole"),)


class ScoreRevision(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "score_revisions"

    score_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scores.id", ondelete="CASCADE"))
    round_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="CASCADE"))
    player_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    hole_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("holes.id"))
    previous_strokes: Mapped[int | None] = mapped_column(Integer)
    new_strokes: Mapped[int] = mapped_column(Integer, nullable=False)
    change_source: Mapped[ScoreChangeSource] = mapped_column(
        enum_column(ScoreChangeSource, "score_change_source"), nullable=False
    )
    changed_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    score: Mapped["Score"] = relationship(back_populates="revisions")


class BonusRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "bonus_rules"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    scope_type: Mapped[ScopeType] = mapped_column(enum_column(ScopeType, "scope_type"), nullable=False)
    tournament_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"))
    round_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="CASCADE"))
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    winner_message: Mapped[str] = mapped_column(Text, nullable=False)
    definition_jsonb: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    animation_preset: Mapped[BonusAnimationPreset] = mapped_column(
        enum_column(BonusAnimationPreset, "bonus_animation_preset"), nullable=False
    )
    animation_lottie_url: Mapped[str | None] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    awards: Mapped[list["BonusAward"]] = relationship(back_populates="bonus_rule", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("points > 0", name="bonus_points_positive"),
        CheckConstraint(
            "(scope_type = 'round' AND round_id IS NOT NULL AND tournament_id IS NULL) OR "
            "(scope_type = 'tournament' AND tournament_id IS NOT NULL AND round_id IS NULL)",
            name="bonus_scope_reference_match",
        ),
    )


class BonusAward(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "bonus_awards"

    bonus_rule_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bonus_rules.id", ondelete="CASCADE"))
    player_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    trigger_score_revision_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("score_revisions.id", ondelete="CASCADE")
    )
    points_snapshot: Mapped[int] = mapped_column(Integer, nullable=False)
    message_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    animation_preset_snapshot: Mapped[BonusAnimationPreset] = mapped_column(
        enum_column(BonusAnimationPreset, "bonus_animation_snapshot_preset"), nullable=False
    )
    animation_lottie_url_snapshot: Mapped[str | None] = mapped_column(Text)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(Text)

    bonus_rule: Mapped["BonusRule"] = relationship(back_populates="awards")


class AchievementRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "achievement_rules"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    scope_type: Mapped[ScopeType] = mapped_column(enum_column(ScopeType, "achievement_scope_type"), nullable=False)
    tournament_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"))
    round_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="CASCADE"))
    title_template: Mapped[str] = mapped_column(String(160), nullable=False)
    message_template: Mapped[str] = mapped_column(Text, nullable=False)
    definition_jsonb: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    icon_preset: Mapped[AchievementIconPreset] = mapped_column(
        enum_column(AchievementIconPreset, "achievement_icon_preset"), nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    events: Mapped[list["AchievementEvent"]] = relationship(back_populates="achievement_rule", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "(scope_type = 'round' AND round_id IS NOT NULL AND tournament_id IS NULL) OR "
            "(scope_type = 'tournament' AND tournament_id IS NOT NULL AND round_id IS NULL)",
            name="achievement_scope_reference_match",
        ),
    )


class AchievementEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "achievement_events"

    achievement_rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("achievement_rules.id", ondelete="CASCADE")
    )
    player_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    round_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="CASCADE"))
    tournament_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE")
    )
    trigger_score_revision_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("score_revisions.id", ondelete="CASCADE")
    )
    occurrence_key: Mapped[str] = mapped_column(String(255), nullable=False)
    title_snapshot: Mapped[str] = mapped_column(String(160), nullable=False)
    message_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    icon_snapshot: Mapped[AchievementIconPreset] = mapped_column(
        enum_column(AchievementIconPreset, "achievement_icon_snapshot_preset"), nullable=False
    )
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(Text)

    achievement_rule: Mapped["AchievementRule"] = relationship(back_populates="events")

    __table_args__ = (
        UniqueConstraint("achievement_rule_id", "occurrence_key", name="uq_achievement_events_rule_occurrence"),
    )


class Notification(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "notifications"

    type: Mapped[NotificationType] = mapped_column(enum_column(NotificationType, "notification_type"), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[NotificationSourceType] = mapped_column(
        enum_column(NotificationSourceType, "notification_source_type"), nullable=False
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    priority: Mapped[NotificationPriority] = mapped_column(
        enum_column(NotificationPriority, "notification_priority"), nullable=False, default=NotificationPriority.NORMAL
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    recipients: Mapped[list["NotificationRecipient"]] = relationship(
        back_populates="notification", cascade="all, delete-orphan"
    )


class NotificationRecipient(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "notification_recipients"

    notification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("notifications.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    popup_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    notification: Mapped["Notification"] = relationship(back_populates="recipients")

    __table_args__ = (UniqueConstraint("notification_id", "user_id", name="uq_notification_recipient_pair"),)


class GalleryMedia(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "gallery_media"

    uploader_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    round_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="CASCADE"))
    hole_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("holes.id"))
    media_type: Mapped[GalleryMediaType] = mapped_column(enum_column(GalleryMediaType, "gallery_media_type"), nullable=False)
    original_path: Mapped[str] = mapped_column(String(255), nullable=False)
    display_path: Mapped[str] = mapped_column(String(255), nullable=False)
    thumbnail_path: Mapped[str | None] = mapped_column(String(255))
    caption: Mapped[str | None] = mapped_column(String(280))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    uploader: Mapped["User"] = relationship(back_populates="gallery_media", foreign_keys=[uploader_user_id])
    round: Mapped["Round"] = relationship(back_populates="gallery_media")
    hole: Mapped["Hole"] = relationship()
    likes: Mapped[list["GalleryMediaLike"]] = relationship(back_populates="media", cascade="all, delete-orphan")
    comments: Mapped[list["GalleryMediaComment"]] = relationship(back_populates="media", cascade="all, delete-orphan")


class GalleryMediaLike(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "gallery_media_likes"

    media_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gallery_media.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    media: Mapped["GalleryMedia"] = relationship(back_populates="likes")
    user: Mapped["User"] = relationship(back_populates="gallery_likes")

    __table_args__ = (UniqueConstraint("media_id", "user_id", name="uq_gallery_media_likes_pair"),)


class GalleryMediaComment(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "gallery_media_comments"

    media_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gallery_media.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    media: Mapped["GalleryMedia"] = relationship(back_populates="comments")
    user: Mapped["User"] = relationship(back_populates="gallery_comments", foreign_keys=[user_id])
