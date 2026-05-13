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


class BonusAwardTiming(StrEnum):
    LIVE = "live"
    ROUND_CLOSE = "round_close"


class BonusRepeatLimit(StrEnum):
    EVERY_QUALIFYING_EVENT = "every_qualifying_event"
    ONE_BATCH_UNTIL_RESET = "one_batch_until_reset"
    ONCE_PER_PLAYER_UNTIL_RESET = "once_per_player_until_reset"
    ONCE_PER_PLAYER_PER_ROUND = "once_per_player_per_round"


class BonusWinnerSelection(StrEnum):
    ALL_MATCHING = "all_matching"
    TOP_X = "top_x"
    BOTTOM_X = "bottom_x"
    TOP_HALF = "top_half"
    BOTTOM_HALF = "bottom_half"


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


class GalleryMediaType(StrEnum):
    PHOTO = "photo"
    VIDEO = "video"
