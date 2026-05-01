from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import AppSetting
from app.schemas.api import AppearanceResponse
from app.utils.serializers import media_url

LOGIN_BACKGROUND_KEY = "appearance.login_background_path"
ADMIN_HERO_BACKGROUND_KEY = "appearance.admin_hero_background_path"

BACKGROUND_SLOT_KEYS = {
    "login": LOGIN_BACKGROUND_KEY,
    "admin-hero": ADMIN_HERO_BACKGROUND_KEY,
}


def get_appearance(db: Session) -> AppearanceResponse:
    settings = {
        item.key: item.value
        for item in db.scalars(
            select(AppSetting).where(AppSetting.key.in_([LOGIN_BACKGROUND_KEY, ADMIN_HERO_BACKGROUND_KEY]))
        ).all()
    }
    return AppearanceResponse(
        login_background_url=media_url(settings.get(LOGIN_BACKGROUND_KEY)),
        admin_hero_background_url=media_url(settings.get(ADMIN_HERO_BACKGROUND_KEY)),
    )


def upsert_setting(db: Session, key: str, value: str) -> None:
    setting = db.get(AppSetting, key)
    if setting:
        setting.value = value
    else:
        db.add(AppSetting(key=key, value=value))
