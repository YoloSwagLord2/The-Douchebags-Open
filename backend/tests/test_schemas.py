import pytest
from pydantic import ValidationError

from app.models.enums import ScopeType
from app.schemas.api import BonusRuleUpdate, HoleInput


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
