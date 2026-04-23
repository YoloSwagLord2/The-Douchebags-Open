import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import BonusRule, AchievementEvent, BonusAward, NotificationRecipient, Round, Score, ScoreRevision, User
from app.models.enums import RoundStatus, ScopeType, ScoreChangeSource
from app.schemas.api import ScorecardResponse, ScorecardUpdateRequest
from app.services.scoring import (
    build_round_meta,
    compute_round_totals,
    ensure_player_can_score,
    get_active_bonus_points_for_round,
    get_player_scores,
    get_round_or_404,
    recompute_achievement_rules,
    recompute_bonus_rules,
)
from app.utils.serializers import (
    achievement_event_response,
    achievement_popup_response,
    bonus_award_response,
    bonus_unlock_response,
    notification_popup_response,
    user_summary,
)

router = APIRouter(tags=["player"])


def _load_active_bonus_awards(db: Session, player_id: uuid.UUID) -> list[BonusAward]:
    return db.scalars(
        select(BonusAward)
        .options(joinedload(BonusAward.bonus_rule))
        .where(BonusAward.player_id == player_id, BonusAward.revoked_at.is_(None))
        .order_by(BonusAward.awarded_at.desc())
    ).all()


def _load_active_bonus_awards_for_round(db: Session, player_id: uuid.UUID, round_obj: Round) -> list[BonusAward]:
    return db.scalars(
        select(BonusAward)
        .options(joinedload(BonusAward.bonus_rule))
        .join(BonusRule, BonusRule.id == BonusAward.bonus_rule_id)
        .where(
            BonusAward.player_id == player_id,
            BonusAward.revoked_at.is_(None),
            (
                ((BonusRule.scope_type == ScopeType.ROUND) & (BonusRule.round_id == round_obj.id))
                | ((BonusRule.scope_type == ScopeType.TOURNAMENT) & (BonusRule.tournament_id == round_obj.tournament_id))
            ),
        )
        .order_by(BonusAward.awarded_at.desc())
    ).all()


def _load_achievement_events(db: Session, player_id: uuid.UUID) -> list[AchievementEvent]:
    return db.scalars(
        select(AchievementEvent)
        .options(joinedload(AchievementEvent.achievement_rule))
        .where(AchievementEvent.player_id == player_id)
        .order_by(AchievementEvent.triggered_at.desc())
    ).all()


def _scorecard_response(
    db: Session,
    round_obj: Round,
    current_user: User,
    newly_unlocked_bonuses: list[BonusAward] | None = None,
    new_achievements: list[AchievementEvent] | None = None,
    new_notifications: list[NotificationRecipient] | None = None,
) -> ScorecardResponse:
    scores_by_hole = get_player_scores(db, round_obj.id, current_user.id)
    computed = compute_round_totals(round_obj.course, float(current_user.hcp), scores_by_hole)
    bonus_points = get_active_bonus_points_for_round(
        db,
        player_id=current_user.id,
        round_id=round_obj.id,
        tournament_id=round_obj.tournament_id,
    )
    computed.totals.bonus_points = bonus_points
    computed.totals.bonus_adjusted_stableford = computed.totals.official_stableford + bonus_points
    active_bonuses = _load_active_bonus_awards_for_round(db, current_user.id, round_obj)
    return ScorecardResponse(
        round=build_round_meta(round_obj),
        player=user_summary(current_user),
        holes=computed.holes,
        totals=computed.totals,
        active_bonuses=[bonus_unlock_response(award) for award in active_bonuses],
        newly_unlocked_bonuses=[bonus_unlock_response(award) for award in newly_unlocked_bonuses or []],
        new_achievements=[achievement_popup_response(item) for item in new_achievements or []],
        new_notifications=[notification_popup_response(item.notification) for item in new_notifications or []],
    )


@router.get("/rounds/{round_id}/scorecard/me", response_model=ScorecardResponse)
def get_my_scorecard(
    round_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScorecardResponse:
    round_obj = get_round_or_404(db, round_id)
    ensure_player_can_score(db, round_obj, current_user.id)
    return _scorecard_response(db, round_obj, current_user)


@router.put("/rounds/{round_id}/scorecard/me", response_model=ScorecardResponse)
def update_my_scorecard(
    round_id: uuid.UUID,
    payload: ScorecardUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScorecardResponse:
    round_obj = get_round_or_404(db, round_id)
    ensure_player_can_score(db, round_obj, current_user.id)
    if round_obj.status == RoundStatus.LOCKED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Round is locked")
    valid_hole_ids = {hole.id for hole in round_obj.course.holes}

    revision_ids: list[uuid.UUID] = []
    now = datetime.now(timezone.utc)
    for score_input in payload.scores:
        if score_input.hole_id not in valid_hole_ids:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Hole does not belong to this round")
        existing = db.scalar(
            select(Score).where(
                Score.round_id == round_id,
                Score.player_id == current_user.id,
                Score.hole_id == score_input.hole_id,
            )
        )
        if existing:
            previous = existing.strokes
            existing.strokes = score_input.strokes
            existing.updated_by_user_id = current_user.id
            score = existing
        else:
            score = Score(
                round_id=round_id,
                player_id=current_user.id,
                hole_id=score_input.hole_id,
                strokes=score_input.strokes,
                updated_by_user_id=current_user.id,
            )
            db.add(score)
            db.flush()
            previous = None

        revision = ScoreRevision(
            score_id=score.id,
            round_id=round_id,
            player_id=current_user.id,
            hole_id=score_input.hole_id,
            previous_strokes=previous,
            new_strokes=score_input.strokes,
            change_source=ScoreChangeSource.PLAYER_SAVE,
            changed_by_user_id=current_user.id,
            created_at=now,
        )
        db.add(revision)
        db.flush()
        revision_ids.append(revision.id)

    recompute_bonus_rules(db, tournament_id=round_obj.tournament_id, round_id=round_obj.id)
    recompute_achievement_rules(db, tournament_id=round_obj.tournament_id, round_id=round_obj.id)
    db.commit()
    db.refresh(round_obj)

    new_bonus_awards = db.scalars(
        select(BonusAward)
        .options(joinedload(BonusAward.bonus_rule))
        .where(
            BonusAward.player_id == current_user.id,
            BonusAward.trigger_score_revision_id.in_(revision_ids),
            BonusAward.revoked_at.is_(None),
        )
    ).all()
    new_achievement_events = db.scalars(
        select(AchievementEvent)
        .options(joinedload(AchievementEvent.achievement_rule))
        .where(
            AchievementEvent.player_id == current_user.id,
            AchievementEvent.trigger_score_revision_id.in_(revision_ids),
            AchievementEvent.revoked_at.is_(None),
        )
    ).all()
    new_notifications = db.scalars(
        select(NotificationRecipient)
        .options(joinedload(NotificationRecipient.notification))
        .join(NotificationRecipient.notification)
        .where(
            NotificationRecipient.user_id == current_user.id,
            NotificationRecipient.popup_seen_at.is_(None),
        )
    ).all()

    return _scorecard_response(
        db,
        round_obj,
        current_user,
        newly_unlocked_bonuses=new_bonus_awards,
        new_achievements=new_achievement_events,
        new_notifications=new_notifications,
    )


@router.get("/players/me/bonus-awards")
def my_bonus_awards(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    awards = _load_active_bonus_awards(db, current_user.id)
    return [bonus_award_response(award) for award in awards]


@router.get("/players/me/achievements")
def my_achievements(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    events = _load_achievement_events(db, current_user.id)
    return [achievement_event_response(event) for event in events]
