from io import BytesIO
from pathlib import Path
import json
import shutil
import subprocess
from tempfile import TemporaryDirectory
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps

from app.core.config import get_settings


PHOTO_MAX_BYTES = 20 * 1024 * 1024
VIDEO_MAX_BYTES = 250 * 1024 * 1024
VIDEO_MAX_DURATION_SECONDS = 120
PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
VIDEO_CONTENT_TYPES = {"video/mp4", "video/quicktime", "video/webm", "video/x-m4v"}


class StoredGalleryMedia(dict):
    original: str
    display: str
    thumbnail: str | None
    duration_seconds: int | None
    size_bytes: int


def _is_flat_white(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return (
        alpha > 0
        and red >= 245
        and green >= 245
        and blue >= 245
        and max(red, green, blue) - min(red, green, blue) <= 12
    )


def _remove_edge_white_background(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    visited: set[tuple[int, int]] = set()
    stack: list[tuple[int, int]] = []

    for x in range(width):
        for y in (0, height - 1):
            if _is_flat_white(pixels[x, y]):
                stack.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if _is_flat_white(pixels[x, y]):
                stack.append((x, y))

    while stack:
        x, y = stack.pop()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        if not _is_flat_white(pixels[x, y]):
            continue

        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)

        if x > 0:
            stack.append((x - 1, y))
        if x < width - 1:
            stack.append((x + 1, y))
        if y > 0:
            stack.append((x, y - 1))
        if y < height - 1:
            stack.append((x, y + 1))

    return image


def _save_variant(image: Image.Image, path: Path, size: tuple[int, int]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    variant = ImageOps.contain(image, size, method=Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (255, 255, 255, 0))
    offset = ((size[0] - variant.width) // 2, (size[1] - variant.height) // 2)
    canvas.alpha_composite(variant, offset)
    canvas.save(path, format="WEBP", quality=90, lossless=True)
    return str(path.relative_to(get_settings().media_root))


async def store_player_photo(user_id, upload: UploadFile) -> dict[str, str]:
    settings = get_settings()
    base_dir = settings.media_root / "players" / str(user_id)
    base_dir.mkdir(parents=True, exist_ok=True)

    contents = await upload.read()
    image = _remove_edge_white_background(Image.open(BytesIO(contents)))

    original_path = base_dir / "original.webp"
    avatar_path = base_dir / "avatar.webp"
    feature_path = base_dir / "feature.webp"

    image.save(original_path, format="WEBP", quality=92, lossless=True)
    return {
        "original": str(original_path.relative_to(settings.media_root)),
        "avatar": _save_variant(image, avatar_path, (320, 320)),
        "feature": _save_variant(image, feature_path, (720, 960)),
    }


async def store_hole_image(hole_id, upload: UploadFile) -> str:
    settings = get_settings()
    base_dir = settings.media_root / "holes" / str(hole_id)
    base_dir.mkdir(parents=True, exist_ok=True)

    contents = await upload.read()
    image = _remove_edge_white_background(Image.open(BytesIO(contents)))

    image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)

    output_path = base_dir / "image.png"
    image.save(output_path, format="PNG", optimize=True)
    return str(output_path.relative_to(settings.media_root))


async def store_ui_background(slot: str, upload: UploadFile) -> str:
    settings = get_settings()
    base_dir = settings.media_root / "appearance"
    base_dir.mkdir(parents=True, exist_ok=True)

    contents = await upload.read()
    image = Image.open(BytesIO(contents)).convert("RGB")
    image.thumbnail((2400, 1600), Image.Resampling.LANCZOS)

    output_path = base_dir / f"{slot}.webp"
    image.save(output_path, format="WEBP", quality=88)
    return str(output_path.relative_to(settings.media_root))


def _content_length(contents: bytes, limit: int, label: str) -> None:
    if len(contents) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{label} is too large",
        )


def _require_command(name: str) -> str:
    command = shutil.which(name)
    if not command:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{name} is not available for media processing",
        )
    return command


def _probe_video_duration(path: Path) -> float:
    ffprobe = _require_command("ffprobe")
    result = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(path),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not read video metadata")
    try:
        duration = float(json.loads(result.stdout)["format"]["duration"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not read video duration") from exc
    if duration > VIDEO_MAX_DURATION_SECONDS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Video is longer than 2 minutes")
    return duration


def _upload_extension(upload: UploadFile, fallback: str) -> str:
    if upload.filename and "." in upload.filename:
        suffix = Path(upload.filename).suffix.lower()
        if suffix:
            return suffix
    return fallback


async def store_gallery_photo(media_id, upload: UploadFile) -> StoredGalleryMedia:
    if upload.content_type not in PHOTO_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported photo type")

    settings = get_settings()
    base_dir = settings.media_root / "gallery" / str(media_id)
    base_dir.mkdir(parents=True, exist_ok=True)

    contents = await upload.read()
    _content_length(contents, PHOTO_MAX_BYTES, "Photo")

    try:
        image = Image.open(BytesIO(contents)).convert("RGBA")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not process photo") from exc

    original_path = base_dir / f"original{_upload_extension(upload, '.image')}"
    display_path = base_dir / "display.png"
    thumbnail_path = base_dir / "thumbnail.png"

    original_path.write_bytes(contents)
    display = ImageOps.contain(image, (1800, 1800), method=Image.Resampling.LANCZOS)
    display.save(display_path, format="PNG", optimize=True)
    thumb = ImageOps.fit(image, (720, 720), method=Image.Resampling.LANCZOS)
    thumb.save(thumbnail_path, format="PNG", optimize=True)
    return StoredGalleryMedia(
        original=str(original_path.relative_to(settings.media_root)),
        display=str(display_path.relative_to(settings.media_root)),
        thumbnail=str(thumbnail_path.relative_to(settings.media_root)),
        duration_seconds=None,
        size_bytes=len(contents),
    )


async def store_gallery_video(media_id, upload: UploadFile) -> StoredGalleryMedia:
    if upload.content_type not in VIDEO_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported video type")

    settings = get_settings()
    base_dir = settings.media_root / "gallery" / str(media_id)
    base_dir.mkdir(parents=True, exist_ok=True)

    contents = await upload.read()
    _content_length(contents, VIDEO_MAX_BYTES, "Video")

    ffmpeg = _require_command("ffmpeg")
    original_path = base_dir / f"original{_upload_extension(upload, '.video')}"
    display_path = base_dir / "display.mp4"
    thumbnail_path = base_dir / "poster.png"
    original_path.write_bytes(contents)

    with TemporaryDirectory() as tmp_dir:
        input_path = Path(tmp_dir) / original_path.name
        input_path.write_bytes(contents)
        duration = _probe_video_duration(input_path)
        transcode = subprocess.run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(input_path),
                "-vf",
                "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-movflags",
                "+faststart",
                str(display_path),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        if transcode.returncode != 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Video transcoding failed")
        poster = subprocess.run(
            [
                ffmpeg,
                "-y",
                "-ss",
                "00:00:01",
                "-i",
                str(display_path),
                "-frames:v",
                "1",
                "-vf",
                "scale=720:-1",
                str(thumbnail_path),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        if poster.returncode != 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Video poster generation failed")

    return StoredGalleryMedia(
        original=str(original_path.relative_to(settings.media_root)),
        display=str(display_path.relative_to(settings.media_root)),
        thumbnail=str(thumbnail_path.relative_to(settings.media_root)),
        duration_seconds=round(duration),
        size_bytes=len(contents),
    )
