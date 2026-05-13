import pytest
from pydantic import ValidationError

from app.models.enums import BonusAwardTiming, BonusWinnerSelection, ScopeType
from app.schemas.api import BonusRuleCreate, BonusRuleUpdate, HoleInput


def test_hole_input_allows_stroke_index_one_to_eighteen() -> None:
    assert HoleInput(hole_number=1, par=4, stroke_index=1, distance=320).stroke_index == 1
    assert HoleInput(hole_number=1, par=4, stroke_index=18, distance=320).stroke_index == 18


def test_hole_input_rejects_stroke_index_outside_supported_range() -> None:
    with pytest.raises(ValidationError):
        HoleInput(hole_number=1, par=4, stroke_index=0, distance=320)

    with pytest.raises(ValidationError):
        HoleInput(hole_number=1, par=4, stroke_index=19, distance=320)


def test_bonus_rule_update_accepts_scope_changes() -> None:
    payload = BonusRuleUpdate(scope_type=ScopeType.ROUND, round_id="00000000-0000-0000-0000-000000000001")

    assert payload.scope_type == ScopeType.ROUND
    assert str(payload.round_id) == "00000000-0000-0000-0000-000000000001"


def test_bonus_rule_create_requires_count_for_top_or_bottom_x() -> None:
    with pytest.raises(ValidationError):
        BonusRuleCreate(
            name="Bottom few",
            scope_type=ScopeType.ROUND,
            round_id="00000000-0000-0000-0000-000000000001",
            points=2,
            winner_message="Bottom bonus",
            definition={"field": "round_holes_played", "operator": "gte", "value": 1},
            animation_preset="confetti",
            award_timing=BonusAwardTiming.ROUND_CLOSE,
            winner_selection=BonusWinnerSelection.BOTTOM_X,
        )


def test_bonus_rule_create_rejects_count_for_half_selection() -> None:
    with pytest.raises(ValidationError):
        BonusRuleCreate(
            name="Bottom half",
            scope_type=ScopeType.ROUND,
            round_id="00000000-0000-0000-0000-000000000001",
            points=2,
            winner_message="Bottom bonus",
            definition={"field": "round_holes_played", "operator": "gte", "value": 1},
            animation_preset="confetti",
            award_timing=BonusAwardTiming.ROUND_CLOSE,
            winner_selection=BonusWinnerSelection.BOTTOM_HALF,
            winner_selection_count=2,
        )
