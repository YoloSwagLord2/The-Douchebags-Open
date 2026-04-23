import uuid

from app.models.entities import Course, Hole
from app.schemas.api import LeaderboardEntry
from app.services.scoring import (
    apply_positions,
    calculate_playing_handicap,
    compute_round_totals,
    handicap_strokes_by_hole,
    stableford_points,
)


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


def test_round_totals_include_net_and_official_stableford() -> None:
    course = build_course()
    scores = {hole.id: hole.par for hole in course.holes[:3]}
    computed = compute_round_totals(course, 12.0, scores)

    assert computed.totals.holes_played == 3
    assert computed.totals.gross_strokes > 0
    assert computed.totals.official_stableford >= 0
    assert computed.holes[0].strokes == course.holes[0].par


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
