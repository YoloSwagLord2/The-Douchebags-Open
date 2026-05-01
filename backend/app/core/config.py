from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str | None = None
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "postgres"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    jwt_secret: str = "change-me"
    jwt_expires_minutes: int = 720
    seed_admin_name: str = "Commissioner"
    seed_admin_email: str = "admin@example.com"
    seed_admin_password: str = "change-me-now"
    media_root: Path = Path("uploads")
    static_root: Path = Path("static")
    api_prefix: str = "/api"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def derive_database_url(self) -> "Settings":
        if self.database_url:
            return self

        user = quote(self.postgres_user, safe="")
        password = quote(self.postgres_password, safe="")
        database = quote(self.postgres_db, safe="")
        object.__setattr__(
            self,
            "database_url",
            f"postgresql+psycopg://{user}:{password}@{self.postgres_host}:{self.postgres_port}/{database}",
        )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
