from enum import StrEnum


class UserRole(StrEnum):
    PLAYER = "player"
    ADMIN = "admin"


class RoundStatus(StrEnum):
    OPEN = "open"
    LOCKED = "locked"


class ScoreChangeSource(StrEnum):
    PLAYER_SAVE = "player_save"
    ADMIN_OVERRIDE = "admin_override"
    SYSTEM_RECOMPUTE = "system_recompute"


class ScopeType(StrEnum):
    ROUND = "round"
    TOURNAMENT = "tournament"


class BonusAnimationPreset(StrEnum):
    CONFETTI = "confetti"
    FIREWORKS = "fireworks"
    SPOTLIGHT = "spotlight"
    CHAOS = "chaos"


class AchievementIconPreset(StrEnum):
    STAR = "star"
    ACE = "ace"
    FLAME = "flame"
    TROPHY = "trophy"


class NotificationType(StrEnum):
    ADMIN_MESSAGE = "admin_message"
    ACHIEVEMENT = "achievement"
    BONUS = "bonus"
    SYSTEM = "system"


class NotificationSourceType(StrEnum):
    ADMIN_MESSAGE = "admin_message"
    ACHIEVEMENT_EVENT = "achievement_event"
    BONUS_AWARD = "bonus_award"
    SYSTEM = "system"


class NotificationPriority(StrEnum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"

