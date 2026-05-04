from app.models.entities import AchievementEvent, BonusAward, GalleryMedia, GalleryMediaComment, Notification, User
from app.schemas.api import (
    AchievementEventResponse,
    AchievementPopupResponse,
    BonusAwardResponse,
    BonusUnlockResponse,
    GalleryAuthorResponse,
    GalleryCommentResponse,
    GalleryMediaResponse,
    NotificationPopupResponse,
    NotificationRecipientResponse,
    NotificationResponse,
    PlayerResponse,
    UserSummary,
)


def media_url(path: str | None) -> str | None:
    return f"/media/{path}" if path else None


def user_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        hcp=float(user.hcp),
        photo_avatar_url=media_url(user.photo_avatar_path),
        photo_feature_url=media_url(user.photo_feature_path),
    )


def gallery_author_response(user: User) -> GalleryAuthorResponse:
    return GalleryAuthorResponse(
        id=user.id,
        name=user.name,
        photo_avatar_url=media_url(user.photo_avatar_path),
    )


def player_response(user: User) -> PlayerResponse:
    return PlayerResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        hcp=float(user.hcp),
        role=user.role,
        is_active=user.is_active,
        photo_avatar_url=media_url(user.photo_avatar_path),
        photo_feature_url=media_url(user.photo_feature_path),
    )


def bonus_unlock_response(award: BonusAward) -> BonusUnlockResponse:
    return BonusUnlockResponse(
        bonus_rule_id=award.bonus_rule_id,
        rule_name=award.bonus_rule.name,
        points=award.points_snapshot,
        message=award.message_snapshot,
        animation_preset=award.animation_preset_snapshot,
        animation_lottie_url=award.animation_lottie_url_snapshot,
    )


def bonus_award_response(award: BonusAward) -> BonusAwardResponse:
    return BonusAwardResponse(
        id=award.id,
        bonus_rule_id=award.bonus_rule_id,
        player_id=award.player_id,
        points_snapshot=award.points_snapshot,
        message_snapshot=award.message_snapshot,
        animation_preset_snapshot=award.animation_preset_snapshot,
        animation_lottie_url_snapshot=award.animation_lottie_url_snapshot,
        awarded_at=award.awarded_at,
        revoked_at=award.revoked_at,
    )


def achievement_popup_response(event: AchievementEvent) -> AchievementPopupResponse:
    return AchievementPopupResponse(
        achievement_event_id=event.id,
        rule_name=event.achievement_rule.name,
        title=event.title_snapshot,
        message=event.message_snapshot,
        icon=event.icon_snapshot,
    )


def achievement_event_response(event: AchievementEvent) -> AchievementEventResponse:
    return AchievementEventResponse(
        id=event.id,
        achievement_rule_id=event.achievement_rule_id,
        player_id=event.player_id,
        title_snapshot=event.title_snapshot,
        message_snapshot=event.message_snapshot,
        icon_snapshot=event.icon_snapshot,
        triggered_at=event.triggered_at,
        revoked_at=event.revoked_at,
    )


def notification_popup_response(notification: Notification) -> NotificationPopupResponse:
    return NotificationPopupResponse(
        notification_id=notification.id,
        type=notification.type,
        title=notification.title,
        body=notification.body,
        priority=notification.priority,
    )


def notification_response(notification: Notification, recipient) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        type=notification.type,
        title=notification.title,
        body=notification.body,
        priority=notification.priority,
        created_at=notification.created_at,
        source_type=notification.source_type,
        source_id=notification.source_id,
        recipient=NotificationRecipientResponse(
            read_at=recipient.read_at,
            popup_seen_at=recipient.popup_seen_at,
            dismissed_at=recipient.dismissed_at,
        ),
    )


def gallery_media_response(
    media: GalleryMedia,
    *,
    like_count: int,
    comment_count: int,
    liked_by_me: bool,
) -> GalleryMediaResponse:
    round_name = media.round.name or f"Round {media.round.round_number}"
    return GalleryMediaResponse(
        id=media.id,
        uploader=gallery_author_response(media.uploader),
        round_id=media.round_id,
        tournament_id=media.round.tournament_id,
        tournament_name=media.round.tournament.name,
        round_name=round_name,
        round_number=media.round.round_number,
        hole_id=media.hole_id,
        hole_number=media.hole.hole_number if media.hole else None,
        media_type=media.media_type,
        display_url=media_url(media.display_path) or "",
        thumbnail_url=media_url(media.thumbnail_path),
        caption=media.caption,
        duration_seconds=media.duration_seconds,
        size_bytes=media.size_bytes,
        like_count=like_count,
        comment_count=comment_count,
        liked_by_me=liked_by_me,
        created_at=media.created_at,
    )


def gallery_comment_response(comment: GalleryMediaComment) -> GalleryCommentResponse:
    return GalleryCommentResponse(
        id=comment.id,
        media_id=comment.media_id,
        author=gallery_author_response(comment.user),
        body=comment.body,
        created_at=comment.created_at,
    )
