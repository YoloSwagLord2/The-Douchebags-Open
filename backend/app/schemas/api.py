from __future__ import annotations

import datetime as dt
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import (
    AchievementIconPreset,
    BonusAnimationPreset,
    NotificationPriority,
    NotificationType,
    RoundStatus,
    ScopeType,
    UserRole,
)


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


class TokenPayload(APIModel):
    sub: str
    exp: int


class AuthLoginRequest(BaseModel):
    username: str
    password: str


class UserSummary(APIModel):
    id: uuid.UUID
    name: str
    email: str
    role: UserRole
    hcp: float
    photo_avatar_url: str | None = None
    photo_feature_url: str | None = None


class AuthResponse(APIModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserSummary


class HoleInput(BaseModel):
    hole_number: int = Field(ge=1, le=36)
    par: int = Field(ge=3, le=7)
    stroke_index: int = Field(ge=1, le=36)
    distance: int = Field(ge=1)


class HoleResponse(APIModel):
    id: uuid.UUID
    hole_number: int
    par: int
    stroke_index: int
    distance: int
    image_url: str | None = None


class CourseCreate(BaseModel):
    name: str
    slope_rating: int = Field(ge=55, le=155)
    course_rating: float = Field(ge=50, le=85)


class CourseUpdate(BaseModel):
    name: str | None = None
    slope_rating: int | None = Field(default=None, ge=55, le=155)
    course_rating: float | None = Field(default=None, ge=50, le=85)


class CourseResponse(APIModel):
    id: uuid.UUID
    name: str
    slope_rating: int
    course_rating: float
    holes: list[HoleResponse]


class PlayerCreate(BaseModel):
    name: str
    username: str = Field(min_length=3, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    hcp: float = Field(ge=0, le=54)
    role: UserRole = UserRole.PLAYER


class PlayerUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8)
    hcp: float | None = Field(default=None, ge=0, le=54)
    role: UserRole | None = None
    is_active: bool | None = None


class PlayerResponse(APIModel):
    id: uuid.UUID
    name: str
    email: str
    hcp: float
    role: UserRole
    is_active: bool
    photo_avatar_url: str | None = None
    photo_feature_url: str | None = None


class TournamentCreate(BaseModel):
    name: str
    date: dt.date


class TournamentUpdate(BaseModel):
    name: str | None = None
    date: dt.date | None = None


class TournamentResponse(APIModel):
    id: uuid.UUID
    name: str
    date: dt.date
    player_ids: list[uuid.UUID] = []


class RoundCreate(BaseModel):
    tournament_id: uuid.UUID
    course_id: uuid.UUID
    round_number: int = Field(ge=1, le=10)
    date: dt.date


class RoundUpdate(BaseModel):
    course_id: uuid.UUID | None = None
    round_number: int | None = Field(default=None, ge=1, le=10)
    date: dt.date | None = None
    status: RoundStatus | None = None


class RoundResponse(APIModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    course_id: uuid.UUID
    round_number: int
    date: dt.date
    status: RoundStatus
    locked_at: dt.datetime | None


class NavigationRound(APIModel):
    id: uuid.UUID
    round_number: int
    date: dt.date
    status: RoundStatus
    course_name: str


class NavigationTournament(APIModel):
    id: uuid.UUID
    name: str
    date: dt.date
    rounds: list[NavigationRound]


class TournamentRosterUpdate(BaseModel):
    player_ids: list[uuid.UUID]


class RoundSummaryItem(APIModel):
    id: uuid.UUID
    round_number: int
    date: dt.date
    course_name: str


class PlayerRoundResult(APIModel):
    round_id: uuid.UUID
    holes_played: int
    stableford: int


class TournamentOverviewEntry(APIModel):
    player_id: uuid.UUID
    player_name: str
    avatar_url: str | None
    round_results: list[PlayerRoundResult]
    total_stableford: int
    total_holes_played: int


class TournamentOverviewResponse(APIModel):
    tournament_id: uuid.UUID
    tournament_name: str
    rounds: list[RoundSummaryItem]
    entries: list[TournamentOverviewEntry]


class ScoreInput(BaseModel):
    hole_id: uuid.UUID
    strokes: int = Field(ge=1, le=25)


class ScorecardUpdateRequest(BaseModel):
    scores: list[ScoreInput]


class HoleScorecardResponse(APIModel):
    hole_id: uuid.UUID
    hole_number: int
    par: int
    stroke_index: int
    distance: int
    strokes: int | None = None
    net_strokes: int | None = None
    stableford_points: int | None = None
    handicap_strokes: int = 0
    image_url: str | None = None


class BonusUnlockResponse(APIModel):
    bonus_rule_id: uuid.UUID
    rule_name: str
    points: int
    message: str
    animation_preset: BonusAnimationPreset
    animation_lottie_url: str | None


class AchievementPopupResponse(APIModel):
    achievement_event_id: uuid.UUID
    rule_name: str
    title: str
    message: str
    icon: AchievementIconPreset


class NotificationPopupResponse(APIModel):
    notification_id: uuid.UUID
    type: NotificationType
    title: str
    body: str
    priority: NotificationPriority


class RoundMeta(APIModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    tournament_name: str
    course_id: uuid.UUID
    course_name: str
    round_number: int
    date: dt.date
    status: RoundStatus


class ScoreTotals(APIModel):
    gross_strokes: int
    net_strokes: int
    official_stableford: int
    bonus_points: int
    bonus_adjusted_stableford: int
    holes_played: int


class ScorecardResponse(APIModel):
    round: RoundMeta
    player: UserSummary
    holes: list[HoleScorecardResponse]
    totals: ScoreTotals
    active_bonuses: list[BonusUnlockResponse]
    newly_unlocked_bonuses: list[BonusUnlockResponse] = []
    new_achievements: list[AchievementPopupResponse] = []
    new_notifications: list[NotificationPopupResponse] = []


class LeaderboardEntry(APIModel):
    player_id: uuid.UUID
    player_name: str
    avatar_url: str | None
    feature_photo_url: str | None
    holes_played: int
    gross_strokes: int
    net_strokes: int
    official_stableford: int
    bonus_points: int
    bonus_adjusted_stableford: int
    official_position: int
    bonus_position: int


class LeaderboardResponse(APIModel):
    scope_type: ScopeType
    tournament: TournamentResponse
    round: RoundResponse | None
    official_entries: list[LeaderboardEntry]
    bonus_entries: list[LeaderboardEntry]


class RulePredicate(BaseModel):
    field: str
    operator: Literal["eq", "ne", "gt", "gte", "lt", "lte", "in"]
    value: Any


class RuleGroup(BaseModel):
    op: Literal["and", "or"]
    conditions: list["RuleGroup | RulePredicate"]


RuleGroup.model_rebuild()


class BonusRuleCreate(BaseModel):
    name: str
    scope_type: ScopeType
    tournament_id: uuid.UUID | None = None
    round_id: uuid.UUID | None = None
    points: int = Field(ge=1)
    winner_message: str
    definition: dict[str, Any]
    animation_preset: BonusAnimationPreset
    animation_lottie_url: str | None = None
    enabled: bool = True


class BonusRuleUpdate(BaseModel):
    name: str | None = None
    points: int | None = Field(default=None, ge=1)
    winner_message: str | None = None
    definition: dict[str, Any] | None = None
    animation_preset: BonusAnimationPreset | None = None
    animation_lottie_url: str | None = None
    enabled: bool | None = None


class BonusRuleResponse(APIModel):
    id: uuid.UUID
    name: str
    scope_type: ScopeType
    tournament_id: uuid.UUID | None
    round_id: uuid.UUID | None
    points: int
    winner_message: str
    definition_jsonb: dict[str, Any]
    animation_preset: BonusAnimationPreset
    animation_lottie_url: str | None
    enabled: bool


class AchievementRuleCreate(BaseModel):
    name: str
    scope_type: ScopeType
    tournament_id: uuid.UUID | None = None
    round_id: uuid.UUID | None = None
    title_template: str
    message_template: str
    definition: dict[str, Any]
    icon_preset: AchievementIconPreset
    enabled: bool = True


class AchievementRuleUpdate(BaseModel):
    name: str | None = None
    title_template: str | None = None
    message_template: str | None = None
    definition: dict[str, Any] | None = None
    icon_preset: AchievementIconPreset | None = None
    enabled: bool | None = None


class AchievementRuleResponse(APIModel):
    id: uuid.UUID
    name: str
    scope_type: ScopeType
    tournament_id: uuid.UUID | None
    round_id: uuid.UUID | None
    title_template: str
    message_template: str
    definition_jsonb: dict[str, Any]
    icon_preset: AchievementIconPreset
    enabled: bool


class NotificationCreate(BaseModel):
    title: str
    body: str
    priority: NotificationPriority = NotificationPriority.NORMAL
    target_type: Literal["individual", "round_roster", "tournament_roster", "all_users"]
    user_id: uuid.UUID | None = None
    round_id: uuid.UUID | None = None
    tournament_id: uuid.UUID | None = None


class NotificationRecipientResponse(APIModel):
    read_at: dt.datetime | None
    popup_seen_at: dt.datetime | None
    dismissed_at: dt.datetime | None


class NotificationResponse(APIModel):
    id: uuid.UUID
    type: NotificationType
    title: str
    body: str
    priority: NotificationPriority
    created_at: dt.datetime
    source_type: str
    source_id: uuid.UUID | None
    recipient: NotificationRecipientResponse | None = None


class BonusAwardResponse(APIModel):
    id: uuid.UUID
    bonus_rule_id: uuid.UUID
    player_id: uuid.UUID
    points_snapshot: int
    message_snapshot: str
    animation_preset_snapshot: BonusAnimationPreset
    animation_lottie_url_snapshot: str | None
    awarded_at: dt.datetime
    revoked_at: dt.datetime | None


class AchievementEventResponse(APIModel):
    id: uuid.UUID
    achievement_rule_id: uuid.UUID
    player_id: uuid.UUID
    title_snapshot: str
    message_snapshot: str
    icon_snapshot: AchievementIconPreset
    triggered_at: dt.datetime
    revoked_at: dt.datetime | None
