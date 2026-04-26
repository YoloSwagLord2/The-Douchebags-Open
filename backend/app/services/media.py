from io import BytesIO
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, ImageOps

from app.core.config import get_settings


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
