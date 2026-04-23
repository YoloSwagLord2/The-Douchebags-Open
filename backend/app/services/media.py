from io import BytesIO
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, ImageOps

from app.core.config import get_settings


def _save_variant(image: Image.Image, path: Path, size: tuple[int, int]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    variant = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS)
    variant.save(path, format="WEBP", quality=90)
    return str(path.relative_to(get_settings().media_root))


async def store_player_photo(user_id, upload: UploadFile) -> dict[str, str]:
    settings = get_settings()
    base_dir = settings.media_root / "players" / str(user_id)
    base_dir.mkdir(parents=True, exist_ok=True)

    contents = await upload.read()
    image = Image.open(BytesIO(contents)).convert("RGB")

    original_path = base_dir / "original.webp"
    avatar_path = base_dir / "avatar.webp"
    feature_path = base_dir / "feature.webp"

    image.save(original_path, format="WEBP", quality=92)
    return {
        "original": str(original_path.relative_to(settings.media_root)),
        "avatar": _save_variant(image, avatar_path, (320, 320)),
        "feature": _save_variant(image, feature_path, (720, 960)),
    }
