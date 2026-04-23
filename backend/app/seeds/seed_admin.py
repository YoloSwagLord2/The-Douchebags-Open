from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.entities import User
from app.models.enums import UserRole
from app.services.auth import hash_password


def main() -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == settings.seed_admin_email.lower()))
        if existing:
            print("Admin already exists")
            return

        admin = User(
            name=settings.seed_admin_name,
            email=settings.seed_admin_email.lower(),
            password_hash=hash_password(settings.seed_admin_password),
            hcp=0,
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print("Admin user created")
    finally:
        db.close()


if __name__ == "__main__":
    main()

