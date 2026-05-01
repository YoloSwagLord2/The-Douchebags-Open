from app.core.config import Settings


def test_database_url_is_derived_from_postgres_settings() -> None:
    settings = Settings(
        postgres_host="postgres",
        postgres_user="douchebags",
        postgres_password="change-me",
        postgres_db="douchebags_open",
    )

    assert settings.database_url == "postgresql+psycopg://douchebags:change-me@postgres:5432/douchebags_open"


def test_explicit_database_url_wins() -> None:
    settings = Settings(database_url="postgresql+psycopg://custom:secret@db:5432/custom")

    assert settings.database_url == "postgresql+psycopg://custom:secret@db:5432/custom"
