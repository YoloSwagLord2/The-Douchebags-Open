from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.entities import (
    AchievementEvent,
    AchievementRule,
    BonusAward,
    BonusRule,
    Course,
    Hole,
    NotificationRecipient,
    Round,
    RoundPlayer,
    Score,
    ScoreRevision,
    Tournament,
    TournamentPlayer,
    User,
)
from app.models.enums import (
    BonusAwardTiming,
    BonusRepeatLimit,
    BonusWinnerSelection,
    NotificationSourceType,
    NotificationType,
    ScopeType,
    ScoreChangeSource,
)
from app.schemas.api import (
    HoleScorecardResponse,
    LeaderboardEntry,
    PlayerRoundResult,
    RoundMeta,
    RoundSummaryItem,
    ScoreTotals,
    TournamentOverviewEntry,
    TournamentOverviewResponse,
)
from app.services.notifications import create_notification
from app.services.rules import evaluate_rule
from app.utils.serializers import media_url


@dataclass
class PlayerRoundComputed:
    holes: list[HoleScorecardResponse]
    totals: ScoreTotals


def _round_half_up(value: float) -> int:
    return int(Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _locked_hcp(db: Session, tournament_id: uuid.UUID, player: User) -> float:
    tp = db.scalar(
        select(TournamentPlayer).where(
            TournamentPlayer.tournament_id == tournament_id,
            TournamentPlayer.player_id == player.id,
        )
    )
    return float(tp.hcp) if tp and tp.hcp is not None else float(player.hcp)


def calculate_playing_handicap(player_hcp: float, course: Course) -> int:
    course_par = sum(hole.par for hole in course.holes)
    hole_count = len(course.holes)
    handicap_allowance = 0.95
    round_handicap = float(player_hcp) * (hole_count / 18)
    raw = (round_handicap * (course.slope_rating / 113) + (float(course.course_rating) - course_par)) * handicap_allowance
    return _round_half_up(raw)


def stableford_points(net_to_par: int) -> int:
    if net_to_par <= -4:
        return 6
    if net_to_par == -3:
        return 5
    if net_to_par == -2:
        return 4
    if net_to_par == -1:
        return 3
    if net_to_par == 0:
        return 2
    if net_to_par == 1:
        return 1
    return 0


def handicap_strokes_by_hole(course: Course, player_hcp: float) -> dict[uuid.UUID, int]:
    ordered_holes = sorted(course.holes, key=lambda hole: hole.stroke_index)
    playing_handicap = calculate_playing_handicap(player_hcp, course)
    n = len(ordered_holes)
    stroke_count = abs(playing_handicap)
    base = stroke_count // n if n else 0
    extra = stroke_count % n if n else 0
    direction = 1 if playing_handicap >= 0 else -1
    allocation: dict[uuid.UUID, int] = {}
    for index, hole in enumerate(ordered_holes, start=1):
        if direction > 0:
            receives_extra = index <= extra
        else:
            receives_extra = index > n - extra
        allocation[hole.id] = direction * (base + (1 if receives_extra else 0))
    return allocation


def compute_round_totals(course: Course, player_hcp: float, scores_by_hole: dict[uuid.UUID, int]) -> PlayerRoundComputed:
    handicap_map = handicap_strokes_by_hole(course, player_hcp)
    holes: list[HoleScorecardResponse] = []
    gross_total = 0
    net_total = 0
    official_stableford = 0
    holes_played = 0

    for hole in sorted(course.holes, key=lambda item: item.hole_number):
        gross = scores_by_hole.get(hole.id)
        handicap_strokes = handicap_map.get(hole.id, 0)
        net = gross - handicap_strokes if gross is not None else None
        stableford = stableford_points(net - hole.par) if net is not None else None
        if gross is not None and net is not None and stableford is not None:
            gross_total += gross
            net_total += net
            official_stableford += stableford
            holes_played += 1
        holes.append(
            HoleScorecardResponse(
                hole_id=hole.id,
                hole_number=hole.hole_number,
                par=hole.par,
                stroke_index=hole.stroke_index,
                distance=hole.distance,
                strokes=gross,
                net_strokes=net,
                stableford_points=stableford,
                handicap_strokes=handicap_strokes,
                image_url=hole.image_url,
                pin_lat=hole.pin_lat,
                pin_lng=hole.pin_lng,
            )
        )

    return PlayerRoundComputed(
        holes=holes,
        totals=ScoreTotals(
            gross_strokes=gross_total,
            net_strokes=net_total,
            official_stableford=official_stableford,
            bonus_points=0,
            bonus_adjusted_stableford=official_stableford,
            holes_played=holes_played,
        ),
    )


def get_round_or_404(db: Session, round_id: uuid.UUID) -> Round:
    round_obj = db.scalar(
        select(Round)
        .options(joinedload(Round.course).joinedload(Course.holes), joinedload(Round.tournament))
        .where(Round.id == round_id)
    )
    if not round_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    return round_obj


def ensure_player_can_score(db: Session, round_obj: Round, player_id: uuid.UUID) -> None:
    if not _player_ids_for_round(db, round_obj):
        roster_entry = db.scalar(
            select(TournamentPlayer).where(
                TournamentPlayer.tournament_id == round_obj.tournament_id,
                TournamentPlayer.player_id == player_id,
            )
        )
        if not roster_entry:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Player is not in the tournament roster")
        return

    round_roster_entry = db.scalar(
        select(RoundPlayer).where(RoundPlayer.round_id == round_obj.id, RoundPlayer.player_id == player_id)
    )
    if not round_roster_entry:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Player is not in this round roster")


def _player_ids_for_round(db: Session, round_obj: Round) -> list[uuid.UUID]:
    return list(db.scalars(select(RoundPlayer.player_id).where(RoundPlayer.round_id == round_obj.id)).all())


def _players_for_round(db: Session, round_obj: Round) -> list[User]:
    round_player_ids = _player_ids_for_round(db, round_obj)
    if round_player_ids:
        return db.scalars(
            select(User)
            .join(RoundPlayer, RoundPlayer.player_id == User.id)
            .where(RoundPlayer.round_id == round_obj.id)
            .order_by(User.name.asc())
        ).all()
    return db.scalars(
        select(User)
        .join(TournamentPlayer, TournamentPlayer.player_id == User.id)
        .where(TournamentPlayer.tournament_id == round_obj.tournament_id)
        .order_by(User.name.asc())
    ).all()


def _round_roster_maps(db: Session, rounds: list[Round]) -> tuple[dict[uuid.UUID, list[User]], dict[uuid.UUID, set[uuid.UUID]]]:
    players_by_round = {round_obj.id: _players_for_round(db, round_obj) for round_obj in rounds}
    player_ids_by_round = {
        round_id: {player.id for player in players}
        for round_id, players in players_by_round.items()
    }
    return players_by_round, player_ids_by_round


def get_player_scores(db: Session, round_id: uuid.UUID, player_id: uuid.UUID) -> dict[uuid.UUID, int]:
    rows = db.scalars(select(Score).where(Score.round_id == round_id, Score.player_id == player_id)).all()
    return {row.hole_id: row.strokes for row in rows}


def build_round_meta(round_obj: Round) -> RoundMeta:
    return RoundMeta(
        id=round_obj.id,
        tournament_id=round_obj.tournament_id,
        tournament_name=round_obj.tournament.name,
        course_id=round_obj.course_id,
        course_name=round_obj.course.name,
        round_number=round_obj.round_number,
        name=round_obj.name,
        date=round_obj.date,
        status=round_obj.status,
    )


def _build_context(
    db: Session,
    round_obj: Round,
    revision: ScoreRevision,
    score_state: dict[tuple[uuid.UUID, uuid.UUID, uuid.UUID], int],
    player_lookup: dict[uuid.UUID, User],
    rounds_by_tournament: dict[uuid.UUID, list[Round]],
) -> dict[str, Any]:
    hole_lookup = {hole.id: hole for hole in round_obj.course.holes}
    current_hole = hole_lookup[revision.hole_id]
    player = player_lookup[revision.player_id]
    player_round_scores = {
        hole_id: strokes
        for (round_id, player_id, hole_id), strokes in score_state.items()
        if round_id == revision.round_id and player_id == revision.player_id
    }
    locked_hcp = _locked_hcp(db, round_obj.tournament_id, player)
    round_computed = compute_round_totals(round_obj.course, locked_hcp, player_round_scores)

    tournament_scores: dict[uuid.UUID, int] = {}
    for tournament_round in rounds_by_tournament[round_obj.tournament_id]:
        for hole in tournament_round.course.holes:
            strokes = score_state.get((tournament_round.id, revision.player_id, hole.id))
            if strokes is not None:
                tournament_scores[(tournament_round.id, hole.id)] = strokes

    tournament_gross = 0
    tournament_net = 0
    tournament_stableford = 0
    tournament_holes_played = 0
    for tournament_round in rounds_by_tournament[round_obj.tournament_id]:
        hole_scores = {
            hole.id: score_state[(tournament_round.id, revision.player_id, hole.id)]
            for hole in tournament_round.course.holes
            if (tournament_round.id, revision.player_id, hole.id) in score_state
        }
        computed = compute_round_totals(tournament_round.course, locked_hcp, hole_scores)
        tournament_gross += computed.totals.gross_strokes
        tournament_net += computed.totals.net_strokes
        tournament_stableford += computed.totals.official_stableford
        tournament_holes_played += computed.totals.holes_played

    handicap_map = handicap_strokes_by_hole(round_obj.course, locked_hcp)
    net_strokes = revision.new_strokes - handicap_map.get(revision.hole_id, 0)
    net_to_par = net_strokes - current_hole.par
    gross_to_par = revision.new_strokes - current_hole.par
    current_stableford = stableford_points(net_to_par)
    round_net_par_streak = current_net_par_streak(
        round_obj.course,
        player_round_scores,
        handicap_map,
        ending_hole_id=revision.hole_id,
    )
    round_metrics = score_metrics_for_course(round_obj.course, player_round_scores, handicap_map)
    previous_hole_context = previous_hole_metrics(round_obj.course, player_round_scores, handicap_map, current_hole.hole_number)
    previous_round_totals = previous_round_metrics(db, round_obj, revision.player_id, locked_hcp, score_state, rounds_by_tournament)
    total_rounds = len(rounds_by_tournament[round_obj.tournament_id])
    position_before_round = tournament_position_before_round(
        db,
        rounds_by_tournament[round_obj.tournament_id],
        round_obj,
        revision.player_id,
        player_lookup,
        score_state,
    )
    roster_size = tournament_roster_size(db, round_obj.tournament_id)

    return {
        "strokes": revision.new_strokes,
        "par": current_hole.par,
        "stroke_index": current_hole.stroke_index,
        "hole_number": current_hole.hole_number,
        "distance": current_hole.distance,
        "gross_to_par": gross_to_par,
        "net_to_par": net_to_par,
        "stableford_points": current_stableford,
        "player_hcp": locked_hcp,
        "previous_hole_strokes": previous_hole_context["strokes"],
        "previous_hole_gross_to_par": previous_hole_context["gross_to_par"],
        "previous_hole_net_to_par": previous_hole_context["net_to_par"],
        "previous_hole_stableford": previous_hole_context["stableford_points"],
        "round_holes_played": round_computed.totals.holes_played,
        "round_total_strokes": round_computed.totals.gross_strokes,
        "round_net_strokes": round_computed.totals.net_strokes,
        "round_net_par_streak": round_net_par_streak,
        "round_stableford": round_computed.totals.official_stableford,
        "round_stableford_delta_prev": (
            round_computed.totals.official_stableford - previous_round_totals["stableford"]
            if previous_round_totals["stableford"] is not None
            else None
        ),
        "round_zero_stableford_holes": round_metrics["zero_stableford_holes"],
        "round_one_stableford_holes": round_metrics["one_stableford_holes"],
        "round_four_plus_stableford_holes": round_metrics["four_plus_stableford_holes"],
        "round_bogey_holes": round_metrics["bogey_holes"],
        "round_par3_stableford": round_metrics["par3_stableford"],
        "round_long_hole_stableford": round_metrics["long_hole_stableford"],
        "front_nine_stableford": round_metrics["front_nine_stableford"],
        "back_nine_stableford": round_metrics["back_nine_stableford"],
        "previous_round_stableford": previous_round_totals["stableford"],
        "previous_round_total_strokes": previous_round_totals["total_strokes"],
        "previous_round_net_strokes": previous_round_totals["net_strokes"],
        "round_number": round_obj.round_number,
        "total_rounds": total_rounds,
        "is_final_round": round_obj.round_number == total_rounds,
        "tournament_position_before_round": position_before_round,
        "is_bottom_half_before_round": position_before_round is not None and position_before_round > (roster_size / 2),
        "is_outside_top3_before_round": position_before_round is not None and position_before_round > 3,
        "tournament_holes_played": tournament_holes_played,
        "tournament_total_strokes": tournament_gross,
        "tournament_net_strokes": tournament_net,
        "tournament_stableford": tournament_stableford,
        "player_name": player.name,
        "round_number": round_obj.round_number,
        "tournament_name": round_obj.tournament.name,
    }


def score_metrics_for_course(
    course: Course,
    scores_by_hole: dict[uuid.UUID, int],
    handicap_map: dict[uuid.UUID, int],
) -> dict[str, int]:
    metrics = {
        "zero_stableford_holes": 0,
        "one_stableford_holes": 0,
        "four_plus_stableford_holes": 0,
        "bogey_holes": 0,
        "par3_stableford": 0,
        "long_hole_stableford": 0,
        "front_nine_stableford": 0,
        "back_nine_stableford": 0,
    }
    for hole in course.holes:
        strokes = scores_by_hole.get(hole.id)
        if strokes is None:
            continue
        gross_to_par = strokes - hole.par
        net_to_par = strokes - handicap_map.get(hole.id, 0) - hole.par
        points = stableford_points(net_to_par)
        if points == 0:
            metrics["zero_stableford_holes"] += 1
        if points == 1:
            metrics["one_stableford_holes"] += 1
        if points >= 4:
            metrics["four_plus_stableford_holes"] += 1
        if gross_to_par == 1:
            metrics["bogey_holes"] += 1
        if hole.par == 3:
            metrics["par3_stableford"] += points
        if hole.distance >= 350:
            metrics["long_hole_stableford"] += points
        if hole.hole_number <= 9:
            metrics["front_nine_stableford"] += points
        else:
            metrics["back_nine_stableford"] += points
    return metrics


def previous_hole_metrics(
    course: Course,
    scores_by_hole: dict[uuid.UUID, int],
    handicap_map: dict[uuid.UUID, int],
    current_hole_number: int,
) -> dict[str, int | None]:
    previous_hole = next((hole for hole in course.holes if hole.hole_number == current_hole_number - 1), None)
    if not previous_hole:
        return {"strokes": None, "gross_to_par": None, "net_to_par": None, "stableford_points": None}
    strokes = scores_by_hole.get(previous_hole.id)
    if strokes is None:
        return {"strokes": None, "gross_to_par": None, "net_to_par": None, "stableford_points": None}
    net_to_par = strokes - handicap_map.get(previous_hole.id, 0) - previous_hole.par
    return {
        "strokes": strokes,
        "gross_to_par": strokes - previous_hole.par,
        "net_to_par": net_to_par,
        "stableford_points": stableford_points(net_to_par),
    }


def previous_round_metrics(
    db: Session,
    round_obj: Round,
    player_id: uuid.UUID,
    player_hcp: float,
    score_state: dict[tuple[uuid.UUID, uuid.UUID, uuid.UUID], int],
    rounds_by_tournament: dict[uuid.UUID, list[Round]],
) -> dict[str, int | None]:
    previous_round = max(
        (
            item
            for item in rounds_by_tournament[round_obj.tournament_id]
            if item.round_number < round_obj.round_number
        ),
        key=lambda item: item.round_number,
        default=None,
    )
    if not previous_round:
        return {"stableford": None, "total_strokes": None, "net_strokes": None}
    scores = {
        hole.id: score_state[(previous_round.id, player_id, hole.id)]
        for hole in previous_round.course.holes
        if (previous_round.id, player_id, hole.id) in score_state
    }
    computed = compute_round_totals(previous_round.course, player_hcp, scores)
    return {
        "stableford": computed.totals.official_stableford,
        "total_strokes": computed.totals.gross_strokes,
        "net_strokes": computed.totals.net_strokes,
    }


def tournament_roster_size(db: Session, tournament_id: uuid.UUID) -> int:
    if not hasattr(db, "scalars"):
        return 1
    count = len(db.scalars(select(TournamentPlayer.player_id).where(TournamentPlayer.tournament_id == tournament_id)).all())
    return count or 1


def tournament_position_before_round(
    db: Session,
    rounds: list[Round],
    current_round: Round,
    player_id: uuid.UUID,
    player_lookup: dict[uuid.UUID, User],
    score_state: dict[tuple[uuid.UUID, uuid.UUID, uuid.UUID], int],
) -> int | None:
    if not hasattr(db, "scalars"):
        return None
    prior_rounds = [item for item in rounds if item.round_number < current_round.round_number]
    if not prior_rounds:
        return None
    tournament_player_ids = db.scalars(
        select(TournamentPlayer.player_id).where(TournamentPlayer.tournament_id == current_round.tournament_id)
    ).all()
    entries: list[tuple[uuid.UUID, int, int, int, str]] = []
    for roster_player_id in tournament_player_ids:
        player = player_lookup.get(roster_player_id)
        if not player:
            continue
        stableford_total = 0
        net_total = 0
        gross_total = 0
        for prior_round in prior_rounds:
            scores = {
                hole.id: score_state[(prior_round.id, roster_player_id, hole.id)]
                for hole in prior_round.course.holes
                if (prior_round.id, roster_player_id, hole.id) in score_state
            }
            computed = compute_round_totals(
                prior_round.course,
                _locked_hcp(db, current_round.tournament_id, player),
                scores,
            )
            stableford_total += computed.totals.official_stableford
            net_total += computed.totals.net_strokes
            gross_total += computed.totals.gross_strokes
        entries.append((roster_player_id, stableford_total, net_total, gross_total, player.name.lower()))
    entries.sort(key=lambda item: (-item[1], item[2], item[3], item[4]))
    previous_key = None
    position = 0
    for index, (entry_player_id, stableford, net, gross, _) in enumerate(entries, start=1):
        key = (stableford, net, gross)
        if key != previous_key:
            position = index
            previous_key = key
        if entry_player_id == player_id:
            return position
    return None


def current_net_par_streak(
    course: Course,
    scores_by_hole: dict[uuid.UUID, int],
    handicap_map: dict[uuid.UUID, int],
    *,
    ending_hole_id: uuid.UUID,
) -> int:
    holes = sorted(course.holes, key=lambda item: item.hole_number)
    ending_index = next((index for index, hole in enumerate(holes) if hole.id == ending_hole_id), None)
    if ending_index is None:
        return 0

    streak = 0
    for hole in reversed(holes[: ending_index + 1]):
        strokes = scores_by_hole.get(hole.id)
        if strokes is None:
            break
        net_to_par = strokes - handicap_map.get(hole.id, 0) - hole.par
        if net_to_par != 0:
            break
        streak += 1
    return streak


def _notification_for_bonus(db: Session, award: BonusAward) -> None:
    rule_name = award.bonus_rule.name if award.bonus_rule else award.manual_title or "Manual bonus"
    if _bonus_logical_key_has_history(db, award.bonus_rule_id, award.logical_key, exclude_award_id=award.id):
        return
    create_notification(
        db,
        title=f"Bonus unlocked: {rule_name}",
        body=award.message_snapshot,
        recipients=[award.player_id],
        notification_type=NotificationType.BONUS,
        source_type=NotificationSourceType.BONUS_AWARD,
        source_id=award.id,
    )


def _notification_for_achievement(db: Session, event: AchievementEvent) -> None:
    create_notification(
        db,
        title=event.title_snapshot,
        body=event.message_snapshot,
        recipients=[event.player_id],
        notification_type=NotificationType.ACHIEVEMENT,
        source_type=NotificationSourceType.ACHIEVEMENT_EVENT,
        source_id=event.id,
    )


def _replay_scope_revisions(
    db: Session, rounds: list[Round]
) -> list[ScoreRevision]:
    round_ids = [round_obj.id for round_obj in rounds]
    _backfill_missing_score_revisions(db, round_ids)
    revisions = db.scalars(
        select(ScoreRevision)
        .where(ScoreRevision.round_id.in_(round_ids))
        .order_by(ScoreRevision.created_at.asc(), ScoreRevision.id.asc())
    ).all()
    return revisions


def _backfill_missing_score_revisions(db: Session, round_ids: list[uuid.UUID]) -> None:
    if not round_ids:
        return
    missing_revision_scores = db.scalars(
        select(Score)
        .outerjoin(ScoreRevision, ScoreRevision.score_id == Score.id)
        .where(Score.round_id.in_(round_ids), ScoreRevision.id.is_(None))
    ).all()
    for score in missing_revision_scores:
        db.add(
            ScoreRevision(
                score_id=score.id,
                round_id=score.round_id,
                player_id=score.player_id,
                hole_id=score.hole_id,
                previous_strokes=None,
                new_strokes=score.strokes,
                change_source=ScoreChangeSource.SYSTEM_RECOMPUTE,
                changed_by_user_id=score.updated_by_user_id,
                created_at=score.updated_at or score.created_at or datetime.now(timezone.utc),
            )
        )
    if missing_revision_scores:
        db.flush()


def _bonus_revision_can_trigger(rule: BonusRule, revision: ScoreRevision) -> bool:
    rule_started_at = rule.updated_at or rule.created_at
    return not rule_started_at or revision.created_at > rule_started_at


def _rule_award_timing(rule: BonusRule) -> BonusAwardTiming:
    return rule.award_timing or BonusAwardTiming.LIVE


def _rule_repeat_limit(rule: BonusRule) -> BonusRepeatLimit:
    return rule.repeat_limit or BonusRepeatLimit.EVERY_QUALIFYING_EVENT


def _rule_winner_selection(rule: BonusRule) -> BonusWinnerSelection:
    return rule.winner_selection or BonusWinnerSelection.ALL_MATCHING


def _rule_reset_cycle(rule: BonusRule) -> int:
    return rule.reset_cycle or 1


def _bonus_logical_key_for_revision(rule: BonusRule, revision: ScoreRevision) -> str:
    reset_cycle = _rule_reset_cycle(rule)
    repeat_limit = _rule_repeat_limit(rule)
    if repeat_limit == BonusRepeatLimit.ONE_BATCH_UNTIL_RESET:
        return f"live:rule:{rule.id}:cycle:{reset_cycle}"
    if repeat_limit == BonusRepeatLimit.ONCE_PER_PLAYER_UNTIL_RESET:
        return f"live:rule:{rule.id}:player:{revision.player_id}:cycle:{reset_cycle}"
    if repeat_limit == BonusRepeatLimit.ONCE_PER_PLAYER_PER_ROUND:
        return f"live:rule:{rule.id}:round:{revision.round_id}:player:{revision.player_id}:cycle:{reset_cycle}"
    return f"live:rule:{rule.id}:revision:{revision.id}:cycle:{reset_cycle}"


def _bonus_logical_key_for_round_close(rule: BonusRule, round_id: uuid.UUID, player_id: uuid.UUID) -> str:
    return f"close:rule:{rule.id}:round:{round_id}:player:{player_id}:cycle:{_rule_reset_cycle(rule)}"


def _bonus_logical_key_has_history(
    db: Session,
    rule_id: uuid.UUID | None,
    logical_key: str,
    *,
    exclude_award_id: uuid.UUID | None = None,
) -> bool:
    statement = select(BonusAward.id).where(BonusAward.logical_key == logical_key)
    statement = statement.where(BonusAward.bonus_rule_id.is_(None) if rule_id is None else BonusAward.bonus_rule_id == rule_id)
    if exclude_award_id is not None:
        statement = statement.where(BonusAward.id != exclude_award_id)
    return db.scalar(statement.limit(1)) is not None


def _round_close_award_allowed(
    db: Session,
    rule: BonusRule,
    *,
    round_id: uuid.UUID,
    player_id: uuid.UUID,
) -> bool:
    reset_cycle = _rule_reset_cycle(rule)
    repeat_limit = _rule_repeat_limit(rule)
    if repeat_limit == BonusRepeatLimit.ONE_BATCH_UNTIL_RESET:
        other_round_award = db.scalar(
            select(BonusAward.id).where(
                BonusAward.bonus_rule_id == rule.id,
                BonusAward.reset_cycle == reset_cycle,
                BonusAward.award_timing_snapshot == BonusAwardTiming.ROUND_CLOSE,
                BonusAward.round_id != round_id,
            ).limit(1)
        )
        return other_round_award is None
    if repeat_limit == BonusRepeatLimit.ONCE_PER_PLAYER_UNTIL_RESET:
        other_round_award = db.scalar(
            select(BonusAward.id).where(
                BonusAward.bonus_rule_id == rule.id,
                BonusAward.player_id == player_id,
                BonusAward.reset_cycle == reset_cycle,
                BonusAward.award_timing_snapshot == BonusAwardTiming.ROUND_CLOSE,
                BonusAward.round_id != round_id,
            ).limit(1)
        )
        return other_round_award is None
    return True


def _update_bonus_award_snapshot(award: BonusAward, rule: BonusRule) -> None:
    award.points_snapshot = rule.points
    award.message_snapshot = rule.winner_message
    award.animation_preset_snapshot = rule.animation_preset
    award.animation_lottie_url_snapshot = rule.animation_lottie_url


def _score_state_for_rounds(db: Session, round_ids: list[uuid.UUID]) -> dict[tuple[uuid.UUID, uuid.UUID, uuid.UUID], int]:
    if not round_ids:
        return {}
    scores = db.scalars(select(Score).where(Score.round_id.in_(round_ids))).all()
    return {(score.round_id, score.player_id, score.hole_id): score.strokes for score in scores}


def _latest_revision_lookup(db: Session, round_ids: list[uuid.UUID]) -> dict[tuple[uuid.UUID, uuid.UUID], ScoreRevision]:
    revisions = db.scalars(
        select(ScoreRevision)
        .where(ScoreRevision.round_id.in_(round_ids))
        .order_by(ScoreRevision.created_at.asc(), ScoreRevision.id.asc())
    ).all()
    latest: dict[tuple[uuid.UUID, uuid.UUID], ScoreRevision] = {}
    for revision in revisions:
        latest[(revision.round_id, revision.player_id)] = revision
    return latest


def _round_snapshot_entries(db: Session, round_obj: Round) -> list[LeaderboardEntry]:
    entries = build_round_leaderboard(db, round_obj, include_round_close_awards=False)
    return apply_positions(entries, mode="bonus")


def _select_ranked_round_close_winners(rule: BonusRule, entries: list[LeaderboardEntry]) -> set[uuid.UUID]:
    if not entries:
        return set()
    selection = _rule_winner_selection(rule)
    if selection == BonusWinnerSelection.TOP_X:
        count = rule.winner_selection_count or 1
        return {entry.player_id for entry in entries if entry.bonus_position <= count}
    if selection == BonusWinnerSelection.BOTTOM_X:
        count = rule.winner_selection_count or 1
        selected_positions = set(sorted({entry.bonus_position for entry in entries}, reverse=True)[:count])
        return {entry.player_id for entry in entries if entry.bonus_position in selected_positions}
    if selection == BonusWinnerSelection.TOP_HALF:
        target_count = (len(entries) + 1) // 2
        boundary_position = entries[target_count - 1].bonus_position
        return {entry.player_id for entry in entries if entry.bonus_position <= boundary_position}
    if selection == BonusWinnerSelection.BOTTOM_HALF:
        target_count = (len(entries) + 1) // 2
        boundary_index = max(len(entries) - target_count, 0)
        boundary_position = entries[boundary_index].bonus_position
        return {entry.player_id for entry in entries if entry.bonus_position >= boundary_position}
    return {entry.player_id for entry in entries}


def _context_for_round_close_player(
    db: Session,
    round_obj: Round,
    player: User,
    score_state: dict[tuple[uuid.UUID, uuid.UUID, uuid.UUID], int],
    player_lookup: dict[uuid.UUID, User],
    rounds_by_tournament: dict[uuid.UUID, list[Round]],
    latest_revisions: dict[tuple[uuid.UUID, uuid.UUID], ScoreRevision],
) -> dict[str, Any] | None:
    revision = latest_revisions.get((round_obj.id, player.id))
    if revision is None:
        scored_holes = [
            hole
            for hole in sorted(round_obj.course.holes, key=lambda item: item.hole_number)
            if (round_obj.id, player.id, hole.id) in score_state
        ]
        if not scored_holes:
            return None
        hole = scored_holes[-1]
        revision = ScoreRevision(
            id=uuid.uuid4(),
            score_id=uuid.uuid4(),
            round_id=round_obj.id,
            player_id=player.id,
            hole_id=hole.id,
            previous_strokes=None,
            new_strokes=score_state[(round_obj.id, player.id, hole.id)],
            change_source=ScoreChangeSource.SYSTEM_RECOMPUTE,
            changed_by_user_id=player.id,
            created_at=round_obj.locked_at or datetime.now(timezone.utc),
        )
    return _build_context(db, round_obj, revision, score_state, player_lookup, rounds_by_tournament)


def recompute_bonus_rules(
    db: Session,
    *,
    tournament_id: uuid.UUID,
    round_id: uuid.UUID | None = None,
) -> None:
    rounds = db.scalars(
        select(Round)
        .options(joinedload(Round.course).joinedload(Course.holes), joinedload(Round.tournament))
        .where(Round.tournament_id == tournament_id)
        .order_by(Round.round_number.asc())
    ).unique().all()
    rounds_by_id = {item.id: item for item in rounds}
    rounds_by_tournament = {tournament_id: rounds}
    player_lookup = {player.id: player for player in db.scalars(select(User)).all()}

    revisions = _replay_scope_revisions(db, rounds)
    round_rules = db.scalars(
        select(BonusRule).where(
            BonusRule.scope_type == ScopeType.ROUND,
            BonusRule.round_id == round_id,
            BonusRule.award_timing == BonusAwardTiming.LIVE,
        )
    ).all() if round_id else []
    tournament_rules = db.scalars(
        select(BonusRule).where(
            BonusRule.scope_type == ScopeType.TOURNAMENT,
            BonusRule.tournament_id == tournament_id,
            BonusRule.award_timing == BonusAwardTiming.LIVE,
        )
    ).all()

    for rule in [*round_rules, *tournament_rules]:
        existing_active = db.scalars(
            select(BonusAward)
            .options(joinedload(BonusAward.bonus_rule))
            .where(BonusAward.bonus_rule_id == rule.id, BonusAward.revoked_at.is_(None))
        ).all()
        existing_by_logical = {award.logical_key: award for award in existing_active}

        if not rule.enabled:
            for award in existing_active:
                award.revoked_at = datetime.now(timezone.utc)
                award.revoked_reason = "Rule disabled"
            continue

        state: dict[tuple[uuid.UUID, uuid.UUID, uuid.UUID], int] = {}
        desired_logical_keys: set[str] = set()
        for revision in revisions:
            current_round = rounds_by_id[revision.round_id]
            if rule.scope_type == ScopeType.ROUND and current_round.id != rule.round_id:
                state[(revision.round_id, revision.player_id, revision.hole_id)] = revision.new_strokes
                continue

            state[(revision.round_id, revision.player_id, revision.hole_id)] = revision.new_strokes
            if not _bonus_revision_can_trigger(rule, revision):
                continue
            context = _build_context(db, current_round, revision, state, player_lookup, rounds_by_tournament)
            if evaluate_rule(rule.definition_jsonb, context):
                occurrence_key = str(revision.id)
                logical_key = _bonus_logical_key_for_revision(rule, revision)
                desired_logical_keys.add(logical_key)
                if logical_key in existing_by_logical:
                    award = existing_by_logical[logical_key]
                    _update_bonus_award_snapshot(award, rule)
                    continue
                award = BonusAward(
                    bonus_rule_id=rule.id,
                    player_id=revision.player_id,
                    round_id=revision.round_id,
                    tournament_id=current_round.tournament_id,
                    trigger_score_revision_id=revision.id,
                    occurrence_key=occurrence_key,
                    logical_key=logical_key,
                    reset_cycle=_rule_reset_cycle(rule),
                    award_timing_snapshot=BonusAwardTiming.LIVE,
                    points_snapshot=rule.points,
                    message_snapshot=rule.winner_message,
                    animation_preset_snapshot=rule.animation_preset,
                    animation_lottie_url_snapshot=rule.animation_lottie_url,
                    awarded_at=revision.created_at,
                )
                db.add(award)
                db.flush()
                award.bonus_rule = rule
                _notification_for_bonus(db, award)
        for logical_key, award in existing_by_logical.items():
            if logical_key not in desired_logical_keys:
                award.revoked_at = datetime.now(timezone.utc)
                award.revoked_reason = "No longer qualified"


def revoke_round_close_bonus_awards(db: Session, round_obj: Round, *, reason: str = "Round unlocked") -> int:
    now = datetime.now(timezone.utc)
    awards = db.scalars(
        select(BonusAward)
        .join(BonusRule, BonusRule.id == BonusAward.bonus_rule_id)
        .where(
            BonusAward.round_id == round_obj.id,
            BonusAward.revoked_at.is_(None),
            BonusAward.award_timing_snapshot == BonusAwardTiming.ROUND_CLOSE,
        )
    ).all()
    for award in awards:
        award.revoked_at = now
        award.revoked_reason = reason
    return len(awards)


def award_round_close_bonus_rules(db: Session, round_obj: Round) -> None:
    revoke_round_close_bonus_awards(db, round_obj, reason="Round close recompute")
    rounds = db.scalars(
        select(Round)
        .options(joinedload(Round.course).joinedload(Course.holes), joinedload(Round.tournament))
        .where(Round.tournament_id == round_obj.tournament_id)
        .order_by(Round.round_number.asc())
    ).unique().all()
    rounds_by_tournament = {round_obj.tournament_id: rounds}
    round_ids = [item.id for item in rounds]
    score_state = _score_state_for_rounds(db, round_ids)
    latest_revisions = _latest_revision_lookup(db, round_ids)
    player_lookup = {player.id: player for player in db.scalars(select(User)).all()}
    roster_players = _players_for_round(db, round_obj)
    roster_players_by_id = {player.id: player for player in roster_players}
    snapshot_entries = _round_snapshot_entries(db, round_obj)
    snapshot_entry_ids = {entry.player_id for entry in snapshot_entries}

    round_rules = db.scalars(
        select(BonusRule).where(
            BonusRule.scope_type == ScopeType.ROUND,
            BonusRule.round_id == round_obj.id,
            BonusRule.award_timing == BonusAwardTiming.ROUND_CLOSE,
        )
    ).all()
    tournament_rules = db.scalars(
        select(BonusRule).where(
            BonusRule.scope_type == ScopeType.TOURNAMENT,
            BonusRule.tournament_id == round_obj.tournament_id,
            BonusRule.award_timing == BonusAwardTiming.ROUND_CLOSE,
        )
    ).all()

    for rule in [*round_rules, *tournament_rules]:
        if not rule.enabled:
            continue

        matching_player_ids: set[uuid.UUID] = set()
        for player in roster_players:
            context = _context_for_round_close_player(
                db,
                round_obj,
                player,
                score_state,
                player_lookup,
                rounds_by_tournament,
                latest_revisions,
            )
            if context is not None and evaluate_rule(rule.definition_jsonb, context):
                matching_player_ids.add(player.id)

        if _rule_winner_selection(rule) == BonusWinnerSelection.ALL_MATCHING:
            winner_ids = matching_player_ids
        else:
            filtered_entries = [entry for entry in snapshot_entries if entry.player_id in matching_player_ids]
            winner_ids = _select_ranked_round_close_winners(rule, filtered_entries)

        for player_id in winner_ids & snapshot_entry_ids:
            player = roster_players_by_id.get(player_id)
            if player is None:
                continue
            if not _round_close_award_allowed(db, rule, round_id=round_obj.id, player_id=player_id):
                continue
            logical_key = _bonus_logical_key_for_round_close(rule, round_obj.id, player_id)
            existing_active = db.scalar(
                select(BonusAward).where(
                    BonusAward.bonus_rule_id == rule.id,
                    BonusAward.logical_key == logical_key,
                    BonusAward.revoked_at.is_(None),
                )
            )
            if existing_active:
                _update_bonus_award_snapshot(existing_active, rule)
                continue
            award = BonusAward(
                bonus_rule_id=rule.id,
                player_id=player_id,
                round_id=round_obj.id,
                tournament_id=round_obj.tournament_id,
                trigger_score_revision_id=None,
                occurrence_key=f"close:{round_obj.id}:{player_id}:{_rule_reset_cycle(rule)}",
                logical_key=logical_key,
                reset_cycle=_rule_reset_cycle(rule),
                award_timing_snapshot=BonusAwardTiming.ROUND_CLOSE,
                points_snapshot=rule.points,
                message_snapshot=rule.winner_message,
                animation_preset_snapshot=rule.animation_preset,
                animation_lottie_url_snapshot=rule.animation_lottie_url,
                awarded_at=round_obj.locked_at or datetime.now(timezone.utc),
            )
            db.add(award)
            db.flush()
            award.bonus_rule = rule
            _notification_for_bonus(db, award)


def recompute_achievement_rules(
    db: Session,
    *,
    tournament_id: uuid.UUID,
    round_id: uuid.UUID | None = None,
) -> None:
    rounds = db.scalars(
        select(Round)
        .options(joinedload(Round.course).joinedload(Course.holes), joinedload(Round.tournament))
        .where(Round.tournament_id == tournament_id)
        .order_by(Round.round_number.asc())
    ).unique().all()
    rounds_by_id = {item.id: item for item in rounds}
    rounds_by_tournament = {tournament_id: rounds}
    player_lookup = {player.id: player for player in db.scalars(select(User)).all()}

    revisions = _replay_scope_revisions(db, rounds)
    round_rules = db.scalars(
        select(AchievementRule).where(AchievementRule.scope_type == ScopeType.ROUND, AchievementRule.round_id == round_id)
    ).all() if round_id else []
    tournament_rules = db.scalars(
        select(AchievementRule).where(
            AchievementRule.scope_type == ScopeType.TOURNAMENT,
            AchievementRule.tournament_id == tournament_id,
        )
    ).all()

    rules = [*round_rules, *tournament_rules]
    for rule in rules:
        existing_active = db.scalars(
            select(AchievementEvent).where(AchievementEvent.achievement_rule_id == rule.id, AchievementEvent.revoked_at.is_(None))
        ).all()
        existing_by_occurrence = {event.occurrence_key: event for event in existing_active}

        if not rule.enabled:
            for event in existing_active:
                event.revoked_at = datetime.now(timezone.utc)
                event.revoked_reason = "Rule disabled"
            continue

        state: dict[tuple[uuid.UUID, uuid.UUID, uuid.UUID], int] = {}
        desired_occurrences: set[str] = set()
        for revision in revisions:
            current_round = rounds_by_id[revision.round_id]
            if rule.scope_type == ScopeType.ROUND and current_round.id != rule.round_id:
                state[(revision.round_id, revision.player_id, revision.hole_id)] = revision.new_strokes
                continue

            state[(revision.round_id, revision.player_id, revision.hole_id)] = revision.new_strokes
            context = _build_context(db, current_round, revision, state, player_lookup, rounds_by_tournament)
            if evaluate_rule(rule.definition_jsonb, context):
                player_name = player_lookup[revision.player_id].name
                occurrence_key = str(revision.id)
                desired_occurrences.add(occurrence_key)
                if occurrence_key in existing_by_occurrence:
                    continue
                title = rule.title_template.format_map(defaultdict(str, context | {"player_name": player_name}))
                message = rule.message_template.format_map(defaultdict(str, context | {"player_name": player_name}))
                event = AchievementEvent(
                    achievement_rule_id=rule.id,
                    player_id=revision.player_id,
                    round_id=current_round.id,
                    tournament_id=current_round.tournament_id,
                    trigger_score_revision_id=revision.id,
                    occurrence_key=occurrence_key,
                    title_snapshot=title,
                    message_snapshot=message,
                    icon_snapshot=rule.icon_preset,
                    triggered_at=revision.created_at,
                )
                db.add(event)
                db.flush()
                event.achievement_rule = rule
                _notification_for_achievement(db, event)
        for occurrence_key, event in existing_by_occurrence.items():
            if occurrence_key not in desired_occurrences:
                event.revoked_at = datetime.now(timezone.utc)
                event.revoked_reason = "No longer qualified"


def get_active_bonus_points_for_round(
    db: Session,
    *,
    player_id: uuid.UUID,
    round_id: uuid.UUID,
    tournament_id: uuid.UUID,
    include_round_close_awards: bool = True,
) -> int:
    timing_values = [BonusAwardTiming.LIVE]
    if include_round_close_awards:
        timing_values.append(BonusAwardTiming.ROUND_CLOSE)
    awards = db.scalars(
        select(BonusAward)
        .outerjoin(BonusRule, BonusRule.id == BonusAward.bonus_rule_id)
        .where(
            BonusAward.player_id == player_id,
            BonusAward.revoked_at.is_(None),
            BonusAward.award_timing_snapshot.in_(timing_values),
            (
                (BonusAward.award_timing_snapshot != BonusAwardTiming.ROUND_CLOSE)
                | (BonusAward.round_id == round_id)
            ),
            (
                ((BonusRule.scope_type == ScopeType.ROUND) & (BonusRule.round_id == round_id))
                | ((BonusRule.scope_type == ScopeType.TOURNAMENT) & (BonusRule.tournament_id == tournament_id))
                | ((BonusAward.bonus_rule_id.is_(None)) & (BonusAward.round_id == round_id))
            ),
        )
    ).all()
    return sum(award.points_snapshot for award in awards)


def get_active_bonus_points_for_tournament(db: Session, *, player_id: uuid.UUID, tournament_id: uuid.UUID) -> int:
    tournament_round_ids = db.scalars(select(Round.id).where(Round.tournament_id == tournament_id)).all()
    awards = db.scalars(
        select(BonusAward)
        .outerjoin(BonusRule, BonusRule.id == BonusAward.bonus_rule_id)
        .where(
            BonusAward.player_id == player_id,
            BonusAward.revoked_at.is_(None),
            (
                ((BonusRule.scope_type == ScopeType.ROUND) & (BonusRule.round_id.in_(tournament_round_ids)))
                | ((BonusRule.scope_type == ScopeType.TOURNAMENT) & (BonusRule.tournament_id == tournament_id))
                | ((BonusAward.bonus_rule_id.is_(None)) & (BonusAward.tournament_id == tournament_id))
            ),
        )
    ).all()
    return sum(award.points_snapshot for award in awards)


def build_round_leaderboard(
    db: Session,
    round_obj: Round,
    *,
    include_round_close_awards: bool = True,
) -> list[LeaderboardEntry]:
    roster_players = _players_for_round(db, round_obj)

    official_entries: list[LeaderboardEntry] = []
    for player in roster_players:
        scores = get_player_scores(db, round_obj.id, player.id)
        computed = compute_round_totals(round_obj.course, _locked_hcp(db, round_obj.tournament_id, player), scores)
        bonus_points = get_active_bonus_points_for_round(
            db,
            player_id=player.id,
            round_id=round_obj.id,
            tournament_id=round_obj.tournament_id,
            include_round_close_awards=include_round_close_awards,
        )
        official_entries.append(
            LeaderboardEntry(
                player_id=player.id,
                player_name=player.name,
                avatar_url=media_url(player.photo_avatar_path),
                feature_photo_url=media_url(player.photo_feature_path),
                holes_played=computed.totals.holes_played,
                gross_strokes=computed.totals.gross_strokes,
                net_strokes=computed.totals.net_strokes,
                official_stableford=computed.totals.official_stableford,
                bonus_points=bonus_points,
                bonus_adjusted_stableford=computed.totals.official_stableford + bonus_points,
                official_position=0,
                bonus_position=0,
            )
        )
    return official_entries


def build_tournament_leaderboard(db: Session, tournament_id: uuid.UUID) -> tuple[Any, list[LeaderboardEntry]]:
    tournament = db.scalar(select(Tournament).where(Tournament.id == tournament_id))
    if not tournament:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    rounds = db.scalars(
        select(Round)
        .options(joinedload(Round.course).joinedload(Course.holes), joinedload(Round.tournament))
        .where(Round.tournament_id == tournament_id)
        .order_by(Round.round_number.asc())
    ).unique().all()
    if not rounds:
        return tournament, []
    players_by_round, player_ids_by_round = _round_roster_maps(db, rounds)
    roster_players_by_id = {player.id: player for players in players_by_round.values() for player in players}
    roster_players = sorted(roster_players_by_id.values(), key=lambda player: player.name)

    entries: list[LeaderboardEntry] = []
    for player in roster_players:
        gross_total = 0
        net_total = 0
        official_stableford = 0
        holes_played = 0
        for round_obj in rounds:
            if player.id not in player_ids_by_round[round_obj.id]:
                continue
            scores = get_player_scores(db, round_obj.id, player.id)
            computed = compute_round_totals(round_obj.course, _locked_hcp(db, tournament_id, player), scores)
            gross_total += computed.totals.gross_strokes
            net_total += computed.totals.net_strokes
            official_stableford += computed.totals.official_stableford
            holes_played += computed.totals.holes_played
        bonus_points = get_active_bonus_points_for_tournament(db, player_id=player.id, tournament_id=tournament_id)
        entries.append(
            LeaderboardEntry(
                player_id=player.id,
                player_name=player.name,
                avatar_url=media_url(player.photo_avatar_path),
                feature_photo_url=media_url(player.photo_feature_path),
                holes_played=holes_played,
                gross_strokes=gross_total,
                net_strokes=net_total,
                official_stableford=official_stableford,
                bonus_points=bonus_points,
                bonus_adjusted_stableford=official_stableford + bonus_points,
                official_position=0,
                bonus_position=0,
            )
        )
    return tournament, entries


def apply_positions(entries: list[LeaderboardEntry], *, mode: str) -> list[LeaderboardEntry]:
    if mode == "official":
        entries.sort(
            key=lambda item: (
                -item.official_stableford,
                item.net_strokes,
                item.gross_strokes,
                item.player_name.lower(),
            )
        )
        previous_key = None
        position = 0
        for index, entry in enumerate(entries, start=1):
            key = (entry.official_stableford, entry.net_strokes, entry.gross_strokes)
            if key != previous_key:
                position = index
                previous_key = key
            entry.official_position = position
        return entries

    entries.sort(
        key=lambda item: (
            -item.bonus_adjusted_stableford,
            -item.official_stableford,
            item.net_strokes,
            item.gross_strokes,
            item.player_name.lower(),
        )
    )
    previous_key = None
    position = 0
    for index, entry in enumerate(entries, start=1):
        key = (
            entry.bonus_adjusted_stableford,
            entry.official_stableford,
            entry.net_strokes,
            entry.gross_strokes,
        )
        if key != previous_key:
            position = index
            previous_key = key
        entry.bonus_position = position
    return entries


def build_tournament_overview(db: Session, tournament_id: uuid.UUID) -> TournamentOverviewResponse:
    tournament = db.scalar(select(Tournament).where(Tournament.id == tournament_id))
    if not tournament:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")

    rounds = db.scalars(
        select(Round)
        .options(joinedload(Round.course).joinedload(Course.holes))
        .where(Round.tournament_id == tournament_id)
        .order_by(Round.round_number.asc())
    ).unique().all()

    round_summaries = [
        RoundSummaryItem(id=r.id, round_number=r.round_number, name=r.name, date=r.date, course_name=r.course.name)
        for r in rounds
    ]

    players_by_round, player_ids_by_round = _round_roster_maps(db, rounds)
    roster_players_by_id = {player.id: player for players in players_by_round.values() for player in players}
    roster_players = sorted(roster_players_by_id.values(), key=lambda player: player.name)

    entries: list[TournamentOverviewEntry] = []
    for player in roster_players:
        round_results: list[PlayerRoundResult] = []
        total_stableford = 0
        total_holes_played = 0
        for round_obj in rounds:
            if player.id not in player_ids_by_round[round_obj.id]:
                round_results.append(PlayerRoundResult(round_id=round_obj.id, holes_played=0, stableford=0))
                continue
            scores = get_player_scores(db, round_obj.id, player.id)
            computed = compute_round_totals(round_obj.course, _locked_hcp(db, tournament_id, player), scores)
            round_results.append(PlayerRoundResult(
                round_id=round_obj.id,
                holes_played=computed.totals.holes_played,
                stableford=computed.totals.official_stableford,
            ))
            total_stableford += computed.totals.official_stableford
            total_holes_played += computed.totals.holes_played
        entries.append(TournamentOverviewEntry(
            player_id=player.id,
            player_name=player.name,
            avatar_url=media_url(player.photo_avatar_path),
            round_results=round_results,
            total_stableford=total_stableford,
            total_holes_played=total_holes_played,
        ))

    entries.sort(key=lambda e: -e.total_stableford)

    return TournamentOverviewResponse(
        tournament_id=tournament.id,
        tournament_name=tournament.name,
        rounds=round_summaries,
        entries=entries,
    )
