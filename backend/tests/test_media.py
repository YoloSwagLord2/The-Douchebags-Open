from io import BytesIO
from uuid import uuid4

import pytest
from fastapi import UploadFile
from PIL import Image

from app.core.config import get_settings
from app.services.media import store_player_photo, store_ui_background


@pytest.mark.anyio("asyncio")
async def test_store_player_photo_creates_expected_variants(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()


@pytest.mark.anyio("asyncio")
async def test_store_ui_background_creates_local_webp(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()

    source = Image.new("RGB", (3200, 1800), "green")
    image_bytes = BytesIO()
    source.save(image_bytes, format="JPEG")
    image_bytes.seek(0)

    stored = await store_ui_background(
        "login",
        UploadFile(filename="background.jpg", file=image_bytes),
    )

    background_path = tmp_path / stored

    assert stored == "appearance/login.webp"
    assert background_path.is_file()
    with Image.open(background_path) as background:
        assert background.format == "WEBP"
        assert background.width <= 2400
        assert background.height <= 1600

    get_settings.cache_clear()

    source = Image.new("RGB", (640, 480), "white")
    source.paste((32, 96, 192), (160, 80, 480, 440))
    image_bytes = BytesIO()
    source.save(image_bytes, format="PNG")
    image_bytes.seek(0)

    stored = await store_player_photo(
        uuid4(),
        UploadFile(filename="player.png", file=image_bytes),
    )

    assert set(stored) == {"original", "avatar", "feature"}

    original_path = tmp_path / stored["original"]
    avatar_path = tmp_path / stored["avatar"]
    feature_path = tmp_path / stored["feature"]

    assert original_path.is_file()
    assert avatar_path.is_file()
    assert feature_path.is_file()

    with Image.open(original_path) as original:
        assert original.format == "WEBP"
        assert original.size == (640, 480)
    with Image.open(avatar_path) as avatar:
        assert avatar.format == "WEBP"
        assert avatar.size == (320, 320)
    with Image.open(feature_path) as feature:
        assert feature.format == "WEBP"
        assert feature.size == (720, 960)

    get_settings.cache_clear()
