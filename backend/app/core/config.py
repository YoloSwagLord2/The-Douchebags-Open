from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/postgres"
    jwt_secret: str = "change-me"
    jwt_expires_minutes: int = 720
    seed_admin_name: str = "Commissioner"
    seed_admin_email: str = "admin@example.com"
    seed_admin_password: str = "change-me-now"
    media_root: Path = Path("uploads")
    api_prefix: str = "/api"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
