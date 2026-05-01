import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.entities import (
    AchievementEvent,
    AchievementRule,
    BonusAward,
    BonusRule,
    Course,
    Hole,
    Notification,
    NotificationRecipient,
    Round,
    Score,
    ScoreRevision,
    Tournament,
    TournamentPlayer,
    User,
)
from app.models.enums import NotificationSourceType, NotificationType, RoundStatus, ScoreChangeSource
from app.schemas.api import (
    AchievementRuleCreate,
    AchievementRuleResponse,
    AchievementRuleUpdate,
    BonusRuleCreate,
    BonusRuleResponse,
    BonusRuleUpdate,
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    HoleInput,
    NotificationCreate,
    NotificationResponse,
    PlayerCreate,
    PlayerResponse,
    PlayerUpdate,
    RoundCreate,
    RoundResponse,
    RoundUpdate,
    ScorecardUpdateRequest,
    TournamentCreate,
    TournamentResponse,
    TournamentRosterUpdate,
    TournamentUpdate,
)
from app.services.auth import hash_password
from app.core.config import get_settings
from app.services.media import store_hole_image, store_player_photo
from app.services.notifications import create_notification
from app.services.rules import validate_rule_definition
from app.services.scoring import (
    get_round_or_404,
    recompute_achievement_rules,
    recompute_bonus_rules,
)
from app.utils.serializers import notification_response, player_response

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/players", response_model=list[PlayerResponse])
def list_players(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[PlayerResponse]:
    players = db.scalars(select(User).order_by(User.name.asc())).all()
    return [player_response(player) for player in players]


@router.post("/players", response_model=PlayerResponse)
def create_player(payload: PlayerCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> PlayerResponse:
    existing_email = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing_email:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    existing_username = db.scalar(select(User).where(User.username == payload.username.lower()))
    if existing_username:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    user = User(
        name=payload.name,
        username=payload.username.lower(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        hcp=payload.hcp,
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return player_response(user)


@router.patch("/players/{player_id}", response_model=PlayerResponse)
def update_player(
    player_id: uuid.UUID,
    payload: PlayerUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PlayerResponse:
    user = db.scalar(select(User).where(User.id == player_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "email":
            setattr(user, field, value.lower())
        elif field == "password":
            user.password_hash = hash_password(value)
        else:
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return player_response(user)


@router.post("/players/{player_id}/photo", response_model=PlayerResponse)
async def upload_player_photo(
    player_id: uuid.UUID,
    file: UploadFile = File(...),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PlayerResponse:
    user = db.scalar(select(User).where(User.id == player_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    stored = await store_player_photo(user.id, file)
    user.photo_original_path = stored["original"]
    user.photo_avatar_path = stored["avatar"]
    user.photo_feature_path = stored["feature"]
    db.commit()
    db.refresh(user)
    return player_response(user)


@router.delete("/players/{player_id}/photo", response_model=PlayerResponse)
def delete_player_photo(player_id: uuid.UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> PlayerResponse:
    user = db.scalar(select(User).where(User.id == player_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    user.photo_original_path = None
    user.photo_avatar_path = None
    user.photo_feature_path = None
    db.commit()
    db.refresh(user)
    return player_response(user)


@router.get("/courses", response_model=list[CourseResponse])
def list_courses(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    courses = db.scalars(select(Course).options(joinedload(Course.holes)).order_by(Course.name.asc())).unique().all()
    return courses


@router.post("/courses", response_model=CourseResponse)
def create_course(payload: CourseCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    course = Course(**payload.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.patch("/courses/{course_id}", response_model=CourseResponse)
def update_course(course_id: uuid.UUID, payload: CourseUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    course = db.scalar(select(Course).options(joinedload(Course.holes)).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return course


@router.delete("/courses/{course_id}")
def delete_course(course_id: uuid.UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    course = db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    db.delete(course)
    db.commit()
    return {"status": "ok"}


@router.put("/courses/{course_id}/holes", response_model=CourseResponse)
def replace_holes(
    course_id: uuid.UUID,
    holes: list[HoleInput],
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    course = db.scalar(select(Course).options(joinedload(Course.holes)).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    existing_images = {hole.hole_number: hole.image_path for hole in course.holes}
    course.holes.clear()
    for hole_payload in holes:
        new_hole = Hole(**hole_payload.model_dump())
        new_hole.image_path = existing_images.get(new_hole.hole_number)
        course.holes.append(new_hole)
    db.commit()
    db.refresh(course)
    return course


def _course_with_holes_or_404(db: Session, course_id: uuid.UUID) -> Course:
    course = db.scalar(select(Course).options(joinedload(Course.holes)).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


@router.post("/holes/{hole_id}/image", response_model=CourseResponse)
async def upload_hole_image(
    hole_id: uuid.UUID,
    file: UploadFile = File(...),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> CourseResponse:
    hole = db.scalar(select(Hole).where(Hole.id == hole_id))
    if not hole:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hole not found")
    hole.image_path = await store_hole_image(hole.id, file)
    db.commit()
    return _course_with_holes_or_404(db, hole.course_id)


@router.delete("/holes/{hole_id}/image", response_model=CourseResponse)
def delete_hole_image(hole_id: uuid.UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> CourseResponse:
    hole = db.scalar(select(Hole).where(Hole.id == hole_id))
    if not hole:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hole not found")
    if hole.image_path:
        media_path = get_settings().media_root / hole.image_path
        if media_path.exists():
            try:
                media_path.unlink()
            except OSError:
                pass
    hole.image_path = None
    db.commit()
    return _course_with_holes_or_404(db, hole.course_id)


@router.get("/tournaments", response_model=list[TournamentResponse])
def list_tournaments(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalars(select(Tournament).options(joinedload(Tournament.players)).order_by(Tournament.date.desc())).unique().all()


@router.post("/tournaments", response_model=TournamentResponse)
def create_tournament(payload: TournamentCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    tournament = Tournament(**payload.model_dump())
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


@router.patch("/tournaments/{tournament_id}", response_model=TournamentResponse)
def update_tournament(
    tournament_id: uuid.UUID,
    payload: TournamentUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    tournament = db.scalar(select(Tournament).where(Tournament.id == tournament_id))
    if not tournament:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(tournament, field, value)
    db.commit()
    db.refresh(tournament)
    return tournament


@router.delete("/tournaments/{tournament_id}")
def delete_tournament(tournament_id: uuid.UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    tournament = db.scalar(select(Tournament).where(Tournament.id == tournament_id))
    if not tournament:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    db.delete(tournament)
    db.commit()
    return {"status": "ok"}


@router.put("/tournaments/{tournament_id}/players")
def update_roster(
    tournament_id: uuid.UUID,
    payload: TournamentRosterUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    tournament = db.scalar(select(Tournament).where(Tournament.id == tournament_id))
    if not tournament:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    db.execute(delete(TournamentPlayer).where(TournamentPlayer.tournament_id == tournament_id))
    for player_id in payload.player_ids:
        db.add(TournamentPlayer(tournament_id=tournament_id, player_id=player_id))
    db.commit()
    return {"status": "ok"}


@router.get("/rounds", response_model=list[RoundResponse])
def list_rounds(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalars(select(Round).order_by(Round.date.desc(), Round.round_number.desc())).all()


@router.post("/rounds", response_model=RoundResponse)
def create_round(payload: RoundCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    round_obj = Round(**payload.model_dump())
    db.add(round_obj)
    db.commit()
    db.refresh(round_obj)
    return round_obj


@router.patch("/rounds/{round_id}", response_model=RoundResponse)
def update_round(round_id: uuid.UUID, payload: RoundUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    round_obj = db.scalar(select(Round).where(Round.id == round_id))
    if not round_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(round_obj, field, value)
    db.commit()
    db.refresh(round_obj)
    return round_obj


@router.delete("/rounds/{round_id}")
def delete_round(round_id: uuid.UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    round_obj = db.scalar(select(Round).where(Round.id == round_id))
    if not round_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    db.delete(round_obj)
    db.commit()
    return {"status": "ok"}


@router.post("/rounds/{round_id}/lock", response_model=RoundResponse)
def lock_round(round_id: uuid.UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    round_obj = db.scalar(select(Round).where(Round.id == round_id))
    if not round_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    round_obj.status = RoundStatus.LOCKED
    round_obj.locked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(round_obj)
    return round_obj


@router.put("/rounds/{round_id}/players/{player_id}/scorecard")
def admin_override_scorecard(
    round_id: uuid.UUID,
    player_id: uuid.UUID,
    payload: ScorecardUpdateRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    round_obj = get_round_or_404(db, round_id)
    valid_hole_ids = {hole.id for hole in round_obj.course.holes}
    revision_ids: list[uuid.UUID] = []
    now = datetime.now(timezone.utc)
    for score_input in payload.scores:
        if score_input.hole_id not in valid_hole_ids:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Hole does not belong to this round")
        existing = db.scalar(
            select(Score).where(Score.round_id == round_id, Score.player_id == player_id, Score.hole_id == score_input.hole_id)
        )
        if existing:
            previous = existing.strokes
            existing.strokes = score_input.strokes
            existing.updated_by_user_id = admin_user.id
            score = existing
        else:
            score = Score(
                round_id=round_id,
                player_id=player_id,
                hole_id=score_input.hole_id,
                strokes=score_input.strokes,
                updated_by_user_id=admin_user.id,
            )
            db.add(score)
            db.flush()
            previous = None
        revision = ScoreRevision(
            score_id=score.id,
            round_id=round_id,
            player_id=player_id,
            hole_id=score_input.hole_id,
            previous_strokes=previous,
            new_strokes=score_input.strokes,
            change_source=ScoreChangeSource.ADMIN_OVERRIDE,
            changed_by_user_id=admin_user.id,
            created_at=now,
        )
        db.add(revision)
        db.flush()
        revision_ids.append(revision.id)
    recompute_bonus_rules(db, tournament_id=round_obj.tournament_id, round_id=round_obj.id)
    recompute_achievement_rules(db, tournament_id=round_obj.tournament_id, round_id=round_obj.id)
    db.commit()
    return {"status": "ok", "revisions": [str(item) for item in revision_ids]}


@router.get("/bonus-rules", response_model=list[BonusRuleResponse])
def list_bonus_rules(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalars(select(BonusRule).order_by(BonusRule.created_at.desc())).all()


@router.post("/bonus-rules", response_model=BonusRuleResponse)
def create_bonus_rule(payload: BonusRuleCreate, admin_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    validate_rule_definition(payload.definition)
    if payload.scope_type == "round" and not payload.round_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="round_id is required")
    if payload.scope_type == "tournament" and not payload.tournament_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="tournament_id is required")
    rule = BonusRule(
        name=payload.name,
        scope_type=payload.scope_type,
        tournament_id=payload.tournament_id,
        round_id=payload.round_id,
        points=payload.points,
        winner_message=payload.winner_message,
        definition_jsonb=payload.definition,
        animation_preset=payload.animation_preset,
        animation_lottie_url=payload.animation_lottie_url,
        enabled=payload.enabled,
        created_by_user_id=admin_user.id,
        updated_by_user_id=admin_user.id,
    )
    db.add(rule)
    db.flush()
    if rule.tournament_id:
        recompute_bonus_rules(db, tournament_id=rule.tournament_id, round_id=rule.round_id)
    else:
        round_obj = get_round_or_404(db, rule.round_id)
        recompute_bonus_rules(db, tournament_id=round_obj.tournament_id, round_id=rule.round_id)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/bonus-rules/{rule_id}", response_model=BonusRuleResponse)
def update_bonus_rule(
    rule_id: uuid.UUID,
    payload: BonusRuleUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rule = db.scalar(select(BonusRule).where(BonusRule.id == rule_id))
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bonus rule not found")
    updates = payload.model_dump(exclude_none=True)
    if "definition" in updates:
        validate_rule_definition(updates["definition"])
        updates["definition_jsonb"] = updates.pop("definition")
    for field, value in updates.items():
        setattr(rule, field, value)
    rule.updated_by_user_id = admin_user.id
    tournament_id = rule.tournament_id or get_round_or_404(db, rule.round_id).tournament_id
    recompute_bonus_rules(db, tournament_id=tournament_id, round_id=rule.round_id)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/bonus-rules/{rule_id}")
def delete_bonus_rule(rule_id: uuid.UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    rule = db.scalar(select(BonusRule).where(BonusRule.id == rule_id))
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bonus rule not found")
    db.delete(rule)
    db.commit()
    return {"status": "ok"}


@router.get("/achievement-rules", response_model=list[AchievementRuleResponse])
def list_achievement_rules(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalars(select(AchievementRule).order_by(AchievementRule.created_at.desc())).all()


@router.post("/achievement-rules", response_model=AchievementRuleResponse)
def create_achievement_rule(
    payload: AchievementRuleCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    validate_rule_definition(payload.definition)
    if payload.scope_type == "round" and not payload.round_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="round_id is required")
    if payload.scope_type == "tournament" and not payload.tournament_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="tournament_id is required")
    rule = AchievementRule(
        name=payload.name,
        scope_type=payload.scope_type,
        tournament_id=payload.tournament_id,
        round_id=payload.round_id,
        title_template=payload.title_template,
        message_template=payload.message_template,
        definition_jsonb=payload.definition,
        icon_preset=payload.icon_preset,
        enabled=payload.enabled,
        created_by_user_id=admin_user.id,
        updated_by_user_id=admin_user.id,
    )
    db.add(rule)
    db.flush()
    tournament_id = rule.tournament_id or get_round_or_404(db, rule.round_id).tournament_id
    recompute_achievement_rules(db, tournament_id=tournament_id, round_id=rule.round_id)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/achievement-rules/{rule_id}", response_model=AchievementRuleResponse)
def update_achievement_rule(
    rule_id: uuid.UUID,
    payload: AchievementRuleUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rule = db.scalar(select(AchievementRule).where(AchievementRule.id == rule_id))
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Achievement rule not found")
    updates = payload.model_dump(exclude_none=True)
    if "definition" in updates:
        validate_rule_definition(updates["definition"])
        updates["definition_jsonb"] = updates.pop("definition")
    for field, value in updates.items():
        setattr(rule, field, value)
    rule.updated_by_user_id = admin_user.id
    tournament_id = rule.tournament_id or get_round_or_404(db, rule.round_id).tournament_id
    recompute_achievement_rules(db, tournament_id=tournament_id, round_id=rule.round_id)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/achievement-rules/{rule_id}")
def delete_achievement_rule(rule_id: uuid.UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    rule = db.scalar(select(AchievementRule).where(AchievementRule.id == rule_id))
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Achievement rule not found")
    db.delete(rule)
    db.commit()
    return {"status": "ok"}


@router.get("/notifications", response_model=list[NotificationResponse])
def admin_notifications(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    notifications = db.scalars(
        select(Notification).options(joinedload(Notification.recipients)).order_by(Notification.created_at.desc())
    ).all()
    responses = []
    for notification in notifications:
        recipient = notification.recipients[0] if notification.recipients else None
        if recipient:
            responses.append(notification_response(notification, recipient))
    return responses


@router.post("/notifications")
def create_admin_notification(
    payload: NotificationCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if payload.target_type == "individual":
        if not payload.user_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="user_id is required")
        recipient_ids = [payload.user_id]
    elif payload.target_type == "round_roster":
        if not payload.round_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="round_id is required")
        round_obj = get_round_or_404(db, payload.round_id)
        recipient_ids = db.scalars(
            select(TournamentPlayer.player_id).where(TournamentPlayer.tournament_id == round_obj.tournament_id)
        ).all()
    elif payload.target_type == "tournament_roster":
        if not payload.tournament_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="tournament_id is required")
        recipient_ids = db.scalars(
            select(TournamentPlayer.player_id).where(TournamentPlayer.tournament_id == payload.tournament_id)
        ).all()
    else:
        recipient_ids = db.scalars(select(User.id).where(User.is_active.is_(True))).all()

    notification = create_notification(
        db,
        title=payload.title,
        body=payload.body,
        recipients=recipient_ids,
        notification_type=NotificationType.ADMIN_MESSAGE,
        source_type=NotificationSourceType.ADMIN_MESSAGE,
        source_id=None,
        priority=payload.priority,
        created_by_user_id=admin_user.id,
    )
    db.commit()
    return {"status": "ok", "notification_id": str(notification.id)}
