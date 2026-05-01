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


def calculate_playing_handicap(player_hcp: float, course: Course) -> int:
    course_par = sum(hole.par for hole in course.holes)
    raw = float(player_hcp) * (course.slope_rating / 113) + (float(course.course_rating) - course_par)
    return max(0, _round_half_up(raw))


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
    hole_count = len(ordered_holes)
    playing_handicap = calculate_playing_handicap(player_hcp, course)
    base = playing_handicap // hole_count if hole_count else 0
    extra = playing_handicap % hole_count if hole_count else 0
    allocation: dict[uuid.UUID, int] = {}
    for index, hole in enumerate(ordered_holes, start=1):
        allocation[hole.id] = base + (1 if index <= extra else 0)
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
    round_computed = compute_round_totals(round_obj.course, float(player.hcp), player_round_scores)

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
        computed = compute_round_totals(tournament_round.course, float(player.hcp), hole_scores)
        tournament_gross += computed.totals.gross_strokes
        tournament_net += computed.totals.net_strokes
        tournament_stableford += computed.totals.official_stableford
        tournament_holes_played += computed.totals.holes_played

    handicap_map = handicap_strokes_by_hole(round_obj.course, float(player.hcp))
    net_strokes = revision.new_strokes - handicap_map.get(revision.hole_id, 0)
    net_to_par = net_strokes - current_hole.par
    gross_to_par = revision.new_strokes - current_hole.par

    return {
        "strokes": revision.new_strokes,
        "par": current_hole.par,
        "stroke_index": current_hole.stroke_index,
        "hole_number": current_hole.hole_number,
        "distance": current_hole.distance,
        "gross_to_par": gross_to_par,
        "net_to_par": net_to_par,
        "round_holes_played": round_computed.totals.holes_played,
        "round_total_strokes": round_computed.totals.gross_strokes,
        "round_net_strokes": round_computed.totals.net_strokes,
        "round_stableford": round_computed.totals.official_stableford,
        "tournament_holes_played": tournament_holes_played,
        "tournament_total_strokes": tournament_gross,
        "tournament_net_strokes": tournament_net,
        "tournament_stableford": tournament_stableford,
        "player_name": player.name,
        "round_number": round_obj.round_number,
        "tournament_name": round_obj.tournament.name,
    }


def _notification_for_bonus(db: Session, award: BonusAward) -> None:
    create_notification(
        db,
        title=f"Bonus unlocked: {award.bonus_rule.name}",
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
    revisions = db.scalars(
        select(ScoreRevision)
        .where(ScoreRevision.round_id.in_(round_ids))
        .order_by(ScoreRevision.created_at.asc(), ScoreRevision.id.asc())
    ).all()
    return revisions


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
        select(BonusRule).where(BonusRule.scope_type == ScopeType.ROUND, BonusRule.round_id == round_id)
    ).all() if round_id else []
    tournament_rules = db.scalars(
        select(BonusRule).where(BonusRule.scope_type == ScopeType.TOURNAMENT, BonusRule.tournament_id == tournament_id)
    ).all()

    for rule in [*round_rules, *tournament_rules]:
        existing_active = db.scalar(
            select(BonusAward)
            .options(joinedload(BonusAward.bonus_rule))
            .where(BonusAward.bonus_rule_id == rule.id, BonusAward.revoked_at.is_(None))
        )

        if not rule.enabled:
            if existing_active:
                existing_active.revoked_at = datetime.now(timezone.utc)
                existing_active.revoked_reason = "Rule disabled"
            continue

        state: dict[tuple[uuid.UUID, uuid.UUID, uuid.UUID], int] = {}
        winner_revision: ScoreRevision | None = None
        winner_round: Round | None = None
        winner_player_id: uuid.UUID | None = None
        for revision in revisions:
            current_round = rounds_by_id[revision.round_id]
            if rule.scope_type == ScopeType.ROUND and current_round.id != rule.round_id:
                state[(revision.round_id, revision.player_id, revision.hole_id)] = revision.new_strokes
                continue

            state[(revision.round_id, revision.player_id, revision.hole_id)] = revision.new_strokes
            context = _build_context(current_round, revision, state, player_lookup, rounds_by_tournament)
            if evaluate_rule(rule.definition_jsonb, context):
                winner_revision = revision
                winner_round = current_round
                winner_player_id = revision.player_id
                break

        if winner_revision and winner_round and winner_player_id:
            if existing_active and existing_active.trigger_score_revision_id == winner_revision.id and existing_active.player_id == winner_player_id:
                existing_active.points_snapshot = rule.points
                existing_active.message_snapshot = rule.winner_message
                existing_active.animation_preset_snapshot = rule.animation_preset
                existing_active.animation_lottie_url_snapshot = rule.animation_lottie_url
            else:
                if existing_active:
                    existing_active.revoked_at = datetime.now(timezone.utc)
                    existing_active.revoked_reason = "Winner changed after recomputation"
                award = BonusAward(
                    bonus_rule_id=rule.id,
                    player_id=winner_player_id,
                    trigger_score_revision_id=winner_revision.id,
                    points_snapshot=rule.points,
                    message_snapshot=rule.winner_message,
                    animation_preset_snapshot=rule.animation_preset,
                    animation_lottie_url_snapshot=rule.animation_lottie_url,
                    awarded_at=winner_revision.created_at,
                )
                db.add(award)
                db.flush()
                award.bonus_rule = rule
                _notification_for_bonus(db, award)
        elif existing_active:
            existing_active.revoked_at = datetime.now(timezone.utc)
            existing_active.revoked_reason = "No longer qualified"


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
            context = _build_context(current_round, revision, state, player_lookup, rounds_by_tournament)
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
) -> int:
    awards = db.scalars(
        select(BonusAward)
        .join(BonusRule, BonusRule.id == BonusAward.bonus_rule_id)
        .where(
            BonusAward.player_id == player_id,
            BonusAward.revoked_at.is_(None),
            (
                ((BonusRule.scope_type == ScopeType.ROUND) & (BonusRule.round_id == round_id))
                | ((BonusRule.scope_type == ScopeType.TOURNAMENT) & (BonusRule.tournament_id == tournament_id))
            ),
        )
    ).all()
    return sum(award.points_snapshot for award in awards)


def get_active_bonus_points_for_tournament(db: Session, *, player_id: uuid.UUID, tournament_id: uuid.UUID) -> int:
    tournament_round_ids = db.scalars(select(Round.id).where(Round.tournament_id == tournament_id)).all()
    awards = db.scalars(
        select(BonusAward)
        .join(BonusRule, BonusRule.id == BonusAward.bonus_rule_id)
        .where(
            BonusAward.player_id == player_id,
            BonusAward.revoked_at.is_(None),
            (
                ((BonusRule.scope_type == ScopeType.ROUND) & (BonusRule.round_id.in_(tournament_round_ids)))
                | ((BonusRule.scope_type == ScopeType.TOURNAMENT) & (BonusRule.tournament_id == tournament_id))
            ),
        )
    ).all()
    return sum(award.points_snapshot for award in awards)


def build_round_leaderboard(db: Session, round_obj: Round) -> list[LeaderboardEntry]:
    roster_players = _players_for_round(db, round_obj)

    official_entries: list[LeaderboardEntry] = []
    for player in roster_players:
        scores = get_player_scores(db, round_obj.id, player.id)
        computed = compute_round_totals(round_obj.course, float(player.hcp), scores)
        bonus_points = get_active_bonus_points_for_round(
            db,
            player_id=player.id,
            round_id=round_obj.id,
            tournament_id=round_obj.tournament_id,
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
            computed = compute_round_totals(round_obj.course, float(player.hcp), scores)
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
            computed = compute_round_totals(round_obj.course, float(player.hcp), scores)
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
