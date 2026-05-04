import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.entities import GalleryMedia, GalleryMediaComment, GalleryMediaLike, Hole, Round, RoundPlayer, User
from app.models.enums import GalleryMediaType, UserRole
from app.schemas.api import GalleryCommentCreate, GalleryCommentResponse, GalleryMediaPage, GalleryMediaResponse
from app.services.media import PHOTO_CONTENT_TYPES, VIDEO_CONTENT_TYPES, store_gallery_photo, store_gallery_video
from app.utils.serializers import gallery_comment_response, gallery_media_response

router = APIRouter(tags=["gallery"])
admin_router = APIRouter(prefix="/admin/gallery", tags=["admin"])


def _active_media_query():
    return select(GalleryMedia).where(GalleryMedia.deleted_at.is_(None))


def _media_or_404(db: Session, media_id: uuid.UUID) -> GalleryMedia:
    media = db.scalar(
        _active_media_query()
        .options(
            joinedload(GalleryMedia.uploader),
            joinedload(GalleryMedia.round).joinedload(Round.tournament),
            joinedload(GalleryMedia.hole),
        )
        .where(GalleryMedia.id == media_id)
    )
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery media not found")
    return media


def _response_for_media(db: Session, media: GalleryMedia, current_user: User) -> GalleryMediaResponse:
    like_count = db.scalar(select(func.count()).select_from(GalleryMediaLike).where(GalleryMediaLike.media_id == media.id)) or 0
    comment_count = (
        db.scalar(
            select(func.count())
            .select_from(GalleryMediaComment)
            .where(GalleryMediaComment.media_id == media.id, GalleryMediaComment.deleted_at.is_(None))
        )
        or 0
    )
    liked_by_me = bool(
        db.scalar(select(GalleryMediaLike.id).where(GalleryMediaLike.media_id == media.id, GalleryMediaLike.user_id == current_user.id))
    )
    return gallery_media_response(media, like_count=like_count, comment_count=comment_count, liked_by_me=liked_by_me)


def _ensure_round_member(db: Session, round_id: uuid.UUID, user: User) -> Round:
    round_obj = db.scalar(select(Round).options(joinedload(Round.course)).where(Round.id == round_id))
    if not round_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    if user.role == UserRole.ADMIN:
        return round_obj
    assigned = db.scalar(select(RoundPlayer.id).where(RoundPlayer.round_id == round_id, RoundPlayer.player_id == user.id))
    if not assigned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this round")
    return round_obj


@router.get("/gallery/media", response_model=GalleryMediaPage)
def list_gallery_media(
    tournament_id: uuid.UUID | None = None,
    round_id: uuid.UUID | None = None,
    hole_id: uuid.UUID | None = None,
    player_id: uuid.UUID | None = None,
    media_type: GalleryMediaType | None = None,
    limit: int = Query(default=48, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GalleryMediaPage:
    query = _active_media_query().join(GalleryMedia.round)
    count_query = select(func.count()).select_from(GalleryMedia).join(GalleryMedia.round).where(GalleryMedia.deleted_at.is_(None))
    filters = []
    if tournament_id:
        filters.append(Round.tournament_id == tournament_id)
    if round_id:
        filters.append(GalleryMedia.round_id == round_id)
    if hole_id:
        filters.append(GalleryMedia.hole_id == hole_id)
    if player_id:
        filters.append(GalleryMedia.uploader_user_id == player_id)
    if media_type:
        filters.append(GalleryMedia.media_type == media_type)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    items = db.scalars(
        query.options(
            joinedload(GalleryMedia.uploader),
            joinedload(GalleryMedia.round).joinedload(Round.tournament),
            joinedload(GalleryMedia.hole),
        )
        .order_by(GalleryMedia.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).unique().all()
    total = db.scalar(count_query) or 0
    return GalleryMediaPage(
        items=[_response_for_media(db, item, current_user) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/rounds/{round_id}/gallery/media", response_model=GalleryMediaResponse)
async def upload_gallery_media(
    round_id: uuid.UUID,
    hole_id: uuid.UUID | None = Form(default=None),
    caption: str | None = Form(default=None, max_length=280),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GalleryMediaResponse:
    round_obj = _ensure_round_member(db, round_id, current_user)
    if hole_id:
        valid_hole = db.scalar(select(Hole.id).where(Hole.id == hole_id, Hole.course_id == round_obj.course_id))
        if not valid_hole:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Hole does not belong to this round")

    media_id = uuid.uuid4()
    if file.content_type in PHOTO_CONTENT_TYPES:
        media_type = GalleryMediaType.PHOTO
        stored = await store_gallery_photo(media_id, file)
    elif file.content_type in VIDEO_CONTENT_TYPES:
        media_type = GalleryMediaType.VIDEO
        stored = await store_gallery_video(media_id, file)
    else:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported media type")

    media = GalleryMedia(
        id=media_id,
        uploader_user_id=current_user.id,
        round_id=round_id,
        hole_id=hole_id,
        media_type=media_type,
        original_path=stored["original"],
        display_path=stored["display"],
        thumbnail_path=stored["thumbnail"],
        caption=caption.strip() if caption and caption.strip() else None,
        duration_seconds=stored["duration_seconds"],
        size_bytes=stored["size_bytes"],
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    media = _media_or_404(db, media.id)
    return _response_for_media(db, media, current_user)


@router.post("/gallery/media/{media_id}/like", response_model=GalleryMediaResponse)
def like_gallery_media(media_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    media = _media_or_404(db, media_id)
    db.add(GalleryMediaLike(media_id=media.id, user_id=current_user.id, created_at=datetime.now(timezone.utc)))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return _response_for_media(db, media, current_user)


@router.delete("/gallery/media/{media_id}/like", response_model=GalleryMediaResponse)
def unlike_gallery_media(media_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    media = _media_or_404(db, media_id)
    db.execute(delete(GalleryMediaLike).where(GalleryMediaLike.media_id == media.id, GalleryMediaLike.user_id == current_user.id))
    db.commit()
    return _response_for_media(db, media, current_user)


@router.get("/gallery/media/{media_id}/comments", response_model=list[GalleryCommentResponse])
def list_gallery_comments(media_id: uuid.UUID, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _media_or_404(db, media_id)
    comments = db.scalars(
        select(GalleryMediaComment)
        .options(joinedload(GalleryMediaComment.user))
        .where(GalleryMediaComment.media_id == media_id, GalleryMediaComment.deleted_at.is_(None))
        .order_by(GalleryMediaComment.created_at.asc())
    ).all()
    return [gallery_comment_response(comment) for comment in comments]


@router.post("/gallery/media/{media_id}/comments", response_model=GalleryCommentResponse)
def create_gallery_comment(
    media_id: uuid.UUID,
    payload: GalleryCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GalleryCommentResponse:
    _media_or_404(db, media_id)
    comment = GalleryMediaComment(
        media_id=media_id,
        user_id=current_user.id,
        body=payload.body.strip(),
        created_at=datetime.now(timezone.utc),
    )
    if not comment.body:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Comment cannot be empty")
    db.add(comment)
    db.commit()
    db.refresh(comment)
    comment = db.scalar(select(GalleryMediaComment).options(joinedload(GalleryMediaComment.user)).where(GalleryMediaComment.id == comment.id))
    return gallery_comment_response(comment)


@admin_router.delete("/media/{media_id}")
def delete_gallery_media(
    media_id: uuid.UUID,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    media = _media_or_404(db, media_id)
    media.deleted_at = datetime.now(timezone.utc)
    media.deleted_by_user_id = admin_user.id
    db.commit()
    return {"status": "deleted"}


@admin_router.delete("/comments/{comment_id}")
def delete_gallery_comment(
    comment_id: uuid.UUID,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    comment = db.scalar(select(GalleryMediaComment).where(GalleryMediaComment.id == comment_id, GalleryMediaComment.deleted_at.is_(None)))
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery comment not found")
    comment.deleted_at = datetime.now(timezone.utc)
    comment.deleted_by_user_id = admin_user.id
    db.commit()
    return {"status": "deleted"}
