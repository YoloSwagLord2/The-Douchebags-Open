import pytest
from pydantic import ValidationError

from app.schemas.api import HoleInput


def test_hole_input_allows_stroke_index_one_to_eighteen() -> None:
    assert HoleInput(hole_number=1, par=4, stroke_index=1, distance=320).stroke_index == 1
    assert HoleInput(hole_number=1, par=4, stroke_index=18, distance=320).stroke_index == 18


def test_hole_input_rejects_stroke_index_outside_supported_range() -> None:
    with pytest.raises(ValidationError):
        HoleInput(hole_number=1, par=4, stroke_index=0, distance=320)

    with pytest.raises(ValidationError):
        HoleInput(hole_number=1, par=4, stroke_index=19, distance=320)
