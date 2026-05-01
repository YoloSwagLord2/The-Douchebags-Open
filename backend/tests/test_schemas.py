import pytest
from pydantic import ValidationError

from app.schemas.api import HoleInput


def test_hole_input_allows_stroke_index_zero_to_nineteen() -> None:
    assert HoleInput(hole_number=1, par=4, stroke_index=0, distance=320).stroke_index == 0
    assert HoleInput(hole_number=1, par=4, stroke_index=19, distance=320).stroke_index == 19


def test_hole_input_rejects_stroke_index_outside_supported_range() -> None:
    with pytest.raises(ValidationError):
        HoleInput(hole_number=1, par=4, stroke_index=-1, distance=320)

    with pytest.raises(ValidationError):
        HoleInput(hole_number=1, par=4, stroke_index=20, distance=320)
