from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import admin, auth, catalog, health, leaderboards, notifications, player
from app.core.config import get_settings


settings = get_settings()
settings.media_root.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="The Douchebags Open API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(catalog.router, prefix=settings.api_prefix)
app.include_router(leaderboards.router, prefix=settings.api_prefix)
app.include_router(notifications.router, prefix=settings.api_prefix)
app.include_router(player.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
app.mount("/media", StaticFiles(directory=Path(settings.media_root)), name="media")

static_root = Path(settings.static_root)
if static_root.is_dir():
    spa_index = static_root / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith(("api/", "media/")):
            raise HTTPException(status_code=404)
        candidate = static_root / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(spa_index)
