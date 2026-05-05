import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import NotificationRecipient, User
from app.schemas.api import NotificationResponse
from app.services.notifications import user_notifications_query
from app.utils.serializers import notification_response

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[NotificationResponse]:
    recipients = db.scalars(user_notifications_query(current_user.id)).all()
    return [notification_response(recipient.notification, recipient) for recipient in recipients]


@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, int]:
    count = db.scalar(
        select(func.count(NotificationRecipient.id)).where(
            NotificationRecipient.user_id == current_user.id,
            NotificationRecipient.read_at.is_(None),
        )
    )
    return {"unread_count": count or 0}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    recipient = db.scalar(
        select(NotificationRecipient).where(
            NotificationRecipient.notification_id == notification_id,
            NotificationRecipient.user_id == current_user.id,
        )
    )
    if not recipient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    now = datetime.now(timezone.utc)
    recipient.read_at = recipient.read_at or now
    recipient.popup_seen_at = recipient.popup_seen_at or now
    db.commit()
    return {"status": "ok"}


@router.post("/{notification_id}/popup-seen")
def mark_popup_seen(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    recipient = db.scalar(
        select(NotificationRecipient).where(
            NotificationRecipient.notification_id == notification_id,
            NotificationRecipient.user_id == current_user.id,
        )
    )
    if not recipient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    recipient.popup_seen_at = recipient.popup_seen_at or datetime.now(timezone.utc)
    db.commit()
    return {"status": "ok"}


@router.post("/read-all")
def mark_all_read(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    recipients = db.scalars(
        select(NotificationRecipient).where(NotificationRecipient.user_id == current_user.id)
    ).all()
    now = datetime.now(timezone.utc)
    for recipient in recipients:
        recipient.read_at = recipient.read_at or now
        recipient.popup_seen_at = recipient.popup_seen_at or now
    db.commit()
    return {"status": "ok"}
