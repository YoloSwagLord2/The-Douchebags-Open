import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.api import LeaderboardResponse, TournamentOverviewResponse
from app.services.scoring import (
    apply_positions,
    build_round_leaderboard,
    build_tournament_leaderboard,
    build_tournament_overview,
    get_round_or_404,
)

router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])


@router.get("/rounds/{round_id}", response_model=LeaderboardResponse)
def round_leaderboard(round_id: uuid.UUID, db: Session = Depends(get_db)) -> LeaderboardResponse:
    round_obj = get_round_or_404(db, round_id)
    entries = build_round_leaderboard(db, round_obj)
    official_entries = apply_positions([entry.model_copy(deep=True) for entry in entries], mode="official")
    bonus_entries = apply_positions([entry.model_copy(deep=True) for entry in entries], mode="bonus")
    return LeaderboardResponse(
        scope_type="round",
        tournament=round_obj.tournament,
        round=round_obj,
        official_entries=official_entries,
        bonus_entries=bonus_entries,
    )


@router.get("/tournaments/{tournament_id}/overview", response_model=TournamentOverviewResponse)
def tournament_overview(tournament_id: uuid.UUID, db: Session = Depends(get_db)) -> TournamentOverviewResponse:
    return build_tournament_overview(db, tournament_id)


@router.get("/tournaments/{tournament_id}", response_model=LeaderboardResponse)
def tournament_leaderboard(tournament_id: uuid.UUID, db: Session = Depends(get_db)) -> LeaderboardResponse:
    tournament, entries = build_tournament_leaderboard(db, tournament_id)
    official_entries = apply_positions([entry.model_copy(deep=True) for entry in entries], mode="official")
    bonus_entries = apply_positions([entry.model_copy(deep=True) for entry in entries], mode="bonus")
    return LeaderboardResponse(
        scope_type="tournament",
        tournament=tournament,
        round=None,
        official_entries=official_entries,
        bonus_entries=bonus_entries,
    )

