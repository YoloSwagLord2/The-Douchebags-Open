from io import BytesIO
import shutil
import subprocess
from uuid import uuid4

import pytest
from fastapi import UploadFile
from PIL import Image
from starlette.datastructures import Headers

from app.core.config import get_settings
from app.services.media import store_gallery_photo, store_gallery_video, store_player_photo, store_ui_background


@pytest.mark.anyio("asyncio")
async def test_store_player_photo_creates_expected_variants(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()


@pytest.mark.anyio("asyncio")
async def test_store_gallery_photo_creates_png_variants(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()

    source = Image.new("RGB", (2200, 1400), "purple")
    image_bytes = BytesIO()
    source.save(image_bytes, format="JPEG")
    image_bytes.seek(0)

    media_id = uuid4()
    stored = await store_gallery_photo(
        media_id,
        UploadFile(filename="moment.jpg", file=image_bytes, headers=Headers({"content-type": "image/jpeg"})),
    )

    assert stored["original"] == f"gallery/{media_id}/original.jpg"
    assert stored["display"] == f"gallery/{media_id}/display.png"
    assert stored["thumbnail"] == f"gallery/{media_id}/thumbnail.png"
    assert stored["duration_seconds"] is None
    assert stored["size_bytes"] > 0

    with Image.open(tmp_path / stored["display"]) as display:
        assert display.format == "PNG"
        assert display.width <= 1800
        assert display.height <= 1800
    with Image.open(tmp_path / stored["thumbnail"]) as thumbnail:
        assert thumbnail.format == "PNG"
        assert thumbnail.size == (720, 720)

    get_settings.cache_clear()


@pytest.mark.anyio("asyncio")
async def test_store_gallery_video_transcodes_to_web_mp4_with_png_poster(monkeypatch, tmp_path) -> None:
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        pytest.skip("ffmpeg is not installed")
    ffmpeg_check = subprocess.run(["ffmpeg", "-version"], check=False, capture_output=True)
    ffprobe_check = subprocess.run(["ffprobe", "-version"], check=False, capture_output=True)
    if ffmpeg_check.returncode != 0 or ffprobe_check.returncode != 0:
        pytest.skip("ffmpeg is installed but not runnable")
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()

    source_path = tmp_path / "source.mov"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:s=320x240:d=1",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-shortest",
            str(source_path),
        ],
        check=True,
        capture_output=True,
    )

    media_id = uuid4()
    stored = await store_gallery_video(
        media_id,
        UploadFile(
            filename="clip.mov",
            file=BytesIO(source_path.read_bytes()),
            headers=Headers({"content-type": "video/quicktime"}),
        ),
    )

    assert stored["original"] == f"gallery/{media_id}/original.mov"
    assert stored["display"] == f"gallery/{media_id}/display.mp4"
    assert stored["thumbnail"] == f"gallery/{media_id}/poster.png"
    assert stored["duration_seconds"] == 1

    assert (tmp_path / stored["display"]).is_file()
    with Image.open(tmp_path / stored["thumbnail"]) as poster:
        assert poster.format == "PNG"

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
