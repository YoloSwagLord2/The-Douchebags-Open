import uuid
from datetime import date, datetime, timezone

from app.models.entities import BonusRule, Course, Hole, Round, Score, ScoreRevision, Tournament, User
from app.models.enums import BonusAnimationPreset, ScopeType, ScoreChangeSource
from app.schemas.api import LeaderboardEntry
from app.services.scoring import (
    _backfill_missing_score_revisions,
    _bonus_revision_can_trigger,
    _build_context,
    apply_positions,
    calculate_playing_handicap,
    compute_round_totals,
    current_net_par_streak,
    handicap_strokes_by_hole,
    stableford_points,
)


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _FakeSession:
    def __init__(self, scores):
        self.scores = scores
        self.added = []
        self.flushed = False

    def scalars(self, _statement):
        return _ScalarResult(self.scores)

    def add(self, item):
        self.added.append(item)

    def flush(self):
        self.flushed = True


def build_course() -> Course:
    course = Course(id=uuid.uuid4(), name="The Open Course", slope_rating=125, course_rating=72.8)
    course.holes = [
        Hole(
            id=uuid.uuid4(),
            hole_number=index,
            par=4 if index % 3 else 5,
            stroke_index=index,
            distance=300 + index * 5,
        )
        for index in range(1, 19)
    ]
    return course


def build_nine_hole_course() -> Course:
    pars = [3, 4, 3, 3, 3, 4, 4, 3, 4]
    course = Course(id=uuid.uuid4(), name="Par 3-ish Nine", slope_rating=113, course_rating=sum(pars))
    course.holes = [
        Hole(
            id=uuid.uuid4(),
            hole_number=index,
            par=par,
            stroke_index=index,
            distance=150 + index * 5,
        )
        for index, par in enumerate(pars, start=1)
    ]
    return course


def test_stableford_mapping() -> None:
    assert stableford_points(-4) == 6
    assert stableford_points(-2) == 4
    assert stableford_points(0) == 2
    assert stableford_points(1) == 1
    assert stableford_points(3) == 0


def test_handicap_allocation_uses_stroke_index_order() -> None:
    course = build_course()
    allocation = handicap_strokes_by_hole(course, 18)
    assert sum(allocation.values()) == calculate_playing_handicap(18, course)
    assert allocation[course.holes[0].id] >= allocation[course.holes[-1].id]


def test_nine_hole_stableford_scales_eighteen_hole_handicap() -> None:
    course = build_nine_hole_course()
    strokes = [5, 5, 4, 4, 4, 5, 5, 4, 4]
    scores = {hole.id: stroke for hole, stroke in zip(course.holes, strokes, strict=True)}

    computed = compute_round_totals(course, 18, scores)

    assert sum(hole.handicap_strokes for hole in computed.holes) == 9
    assert [hole.stableford_points for hole in computed.holes] == [1, 2, 2, 2, 2, 2, 2, 2, 3]
    assert computed.totals.official_stableford == 18


def test_plus_handicap_gives_strokes_back_from_easiest_holes() -> None:
    course = build_course()
    course.slope_rating = 113
    course.course_rating = sum(hole.par for hole in course.holes)

    allocation = handicap_strokes_by_hole(course, -4)

    assert sum(allocation.values()) == -4
    assert allocation[course.holes[0].id] == 0
    assert allocation[course.holes[-1].id] == -1


def test_round_totals_include_net_and_official_stableford() -> None:
    course = build_course()
    scores = {hole.id: hole.par for hole in course.holes[:3]}
    computed = compute_round_totals(course, 12.0, scores)

    assert computed.totals.holes_played == 3
    assert computed.totals.gross_strokes > 0
    assert computed.totals.official_stableford >= 0
    assert computed.holes[0].strokes == course.holes[0].par


def test_current_net_par_streak_counts_consecutive_net_pars_ending_on_current_hole() -> None:
    course = build_course()
    handicap_map = {hole.id: 0 for hole in course.holes}
    scores = {
        course.holes[0].id: course.holes[0].par,
        course.holes[1].id: course.holes[1].par,
        course.holes[2].id: course.holes[2].par,
    }

    assert current_net_par_streak(course, scores, handicap_map, ending_hole_id=course.holes[2].id) == 3


def test_current_net_par_streak_resets_on_non_net_par_or_gap() -> None:
    course = build_course()
    handicap_map = {hole.id: 0 for hole in course.holes}
    scores = {
        course.holes[0].id: course.holes[0].par,
        course.holes[1].id: course.holes[1].par + 1,
        course.holes[2].id: course.holes[2].par,
    }

    assert current_net_par_streak(course, scores, handicap_map, ending_hole_id=course.holes[2].id) == 1
    assert current_net_par_streak(course, {}, handicap_map, ending_hole_id=course.holes[2].id) == 0


def test_missing_score_revisions_are_backfilled_for_bonus_replay() -> None:
    score = Score(
        id=uuid.uuid4(),
        round_id=uuid.uuid4(),
        player_id=uuid.uuid4(),
        hole_id=uuid.uuid4(),
        strokes=10,
        updated_by_user_id=uuid.uuid4(),
        updated_at=datetime(2026, 5, 6, tzinfo=timezone.utc),
    )
    db = _FakeSession([score])

    _backfill_missing_score_revisions(db, [score.round_id])

    assert db.flushed is True
    assert len(db.added) == 1
    revision = db.added[0]
    assert revision.score_id == score.id
    assert revision.new_strokes == 10
    assert revision.change_source == ScoreChangeSource.SYSTEM_RECOMPUTE
    assert revision.created_at == score.updated_at


def test_bonus_revisions_only_trigger_after_rule_activation() -> None:
    rule = BonusRule(
        id=uuid.uuid4(),
        name="Fresh score only",
        scope_type=ScopeType.ROUND,
        round_id=uuid.uuid4(),
        points=1,
        winner_message="Fresh",
        definition_jsonb={"field": "strokes", "operator": "gte", "value": 10},
        animation_preset=BonusAnimationPreset.CONFETTI,
        created_by_user_id=uuid.uuid4(),
        updated_by_user_id=uuid.uuid4(),
        created_at=datetime(2026, 5, 10, 12, tzinfo=timezone.utc),
        updated_at=datetime(2026, 5, 10, 12, tzinfo=timezone.utc),
    )
    base_revision = ScoreRevision(
        id=uuid.uuid4(),
        score_id=uuid.uuid4(),
        round_id=rule.round_id,
        player_id=uuid.uuid4(),
        hole_id=uuid.uuid4(),
        previous_strokes=None,
        new_strokes=10,
        change_source=ScoreChangeSource.PLAYER_SAVE,
        changed_by_user_id=uuid.uuid4(),
        created_at=datetime(2026, 5, 10, 12, tzinfo=timezone.utc),
    )
    later_revision = ScoreRevision(
        id=uuid.uuid4(),
        score_id=uuid.uuid4(),
        round_id=rule.round_id,
        player_id=uuid.uuid4(),
        hole_id=uuid.uuid4(),
        previous_strokes=None,
        new_strokes=10,
        change_source=ScoreChangeSource.PLAYER_SAVE,
        changed_by_user_id=uuid.uuid4(),
        created_at=datetime(2026, 5, 10, 12, 1, tzinfo=timezone.utc),
    )

    assert _bonus_revision_can_trigger(rule, base_revision) is False
    assert _bonus_revision_can_trigger(rule, later_revision) is True


def test_rule_context_uses_supplied_db_for_locked_handicap(monkeypatch) -> None:
    course = build_nine_hole_course()
    tournament = Tournament(
        id=uuid.uuid4(),
        name="Fresh Bonus Open",
        date=date(2026, 5, 10),
    )
    round_obj = Round(
        id=uuid.uuid4(),
        tournament_id=tournament.id,
        course_id=course.id,
        round_number=1,
        name="Round 1",
        date=tournament.date,
        tournament=tournament,
        course=course,
    )
    player = User(
        id=uuid.uuid4(),
        name="Player One",
        username="player-one",
        email="player@example.com",
        password_hash="test",
        hcp=0,
    )
    revision = ScoreRevision(
        id=uuid.uuid4(),
        score_id=uuid.uuid4(),
        round_id=round_obj.id,
        player_id=player.id,
        hole_id=course.holes[0].id,
        previous_strokes=None,
        new_strokes=course.holes[0].par,
        change_source=ScoreChangeSource.PLAYER_SAVE,
        changed_by_user_id=player.id,
        created_at=datetime(2026, 5, 10, 12, 1, tzinfo=timezone.utc),
    )
    fake_db = object()
    seen_db = None

    def fake_locked_hcp(db, tournament_id, user):
        nonlocal seen_db
        seen_db = db
        assert tournament_id == tournament.id
        assert user == player
        return 0

    monkeypatch.setattr("app.services.scoring._locked_hcp", fake_locked_hcp)

    context = _build_context(
        fake_db,
        round_obj,
        revision,
        {(round_obj.id, player.id, course.holes[0].id): course.holes[0].par},
        {player.id: player},
        {tournament.id: [round_obj]},
    )

    assert seen_db is fake_db
    assert context["strokes"] == course.holes[0].par
    assert context["net_to_par"] == 0
    assert context["round_stableford"] == 2


def test_leaderboard_positions_handle_ties() -> None:
    entries = [
        LeaderboardEntry(
            player_id=uuid.uuid4(),
            player_name="Alpha",
            avatar_url=None,
            feature_photo_url=None,
            holes_played=18,
            gross_strokes=70,
            net_strokes=68,
            official_stableford=36,
            bonus_points=1,
            bonus_adjusted_stableford=37,
            official_position=0,
            bonus_position=0,
        ),
        LeaderboardEntry(
            player_id=uuid.uuid4(),
            player_name="Bravo",
            avatar_url=None,
            feature_photo_url=None,
            holes_played=18,
            gross_strokes=70,
            net_strokes=68,
            official_stableford=36,
            bonus_points=2,
            bonus_adjusted_stableford=38,
            official_position=0,
            bonus_position=0,
        ),
    ]

    official = apply_positions([entry.model_copy(deep=True) for entry in entries], mode="official")
    bonus = apply_positions([entry.model_copy(deep=True) for entry in entries], mode="bonus")

    assert official[0].official_position == 1
    assert official[1].official_position == 1
    assert bonus[0].player_name == "Bravo"
