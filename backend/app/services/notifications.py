from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, joinedload

from app.models.entities import Notification, NotificationRecipient
from app.models.enums import NotificationPriority, NotificationSourceType, NotificationType


def create_notification(
    db: Session,
    *,
    title: str,
    body: str,
    recipients: Iterable,
    notification_type: NotificationType,
    source_type: NotificationSourceType,
    source_id,
    priority: NotificationPriority = NotificationPriority.NORMAL,
    created_by_user_id=None,
) -> Notification:
    notification = Notification(
        type=notification_type,
        title=title,
        body=body,
        source_type=source_type,
        source_id=source_id,
        priority=priority,
        created_by_user_id=created_by_user_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(notification)
    db.flush()

    for user_id in recipients:
        db.add(NotificationRecipient(notification_id=notification.id, user_id=user_id))

    db.flush()
    return notification


def user_notifications_query(user_id) -> Select[tuple[NotificationRecipient]]:
    return (
        select(NotificationRecipient)
        .options(joinedload(NotificationRecipient.notification))
        .where(NotificationRecipient.user_id == user_id)
        .order_by(NotificationRecipient.id.desc())
    )
