from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Round, RoundPlayer, Tournament, TournamentPlayer, User
from app.models.enums import UserRole
from app.schemas.api import AppearanceResponse, NavigationRound, NavigationTournament
from app.services.appearance import get_appearance

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/appearance", response_model=AppearanceResponse)
def appearance(db: Session = Depends(get_db)) -> AppearanceResponse:
    return get_appearance(db)


@router.get("/navigation", response_model=list[NavigationTournament])
def navigation(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[NavigationTournament]:
    if current_user.role == UserRole.ADMIN:
        tournaments = db.scalars(
            select(Tournament)
            .options(joinedload(Tournament.rounds).joinedload(Round.course))
            .order_by(Tournament.date.desc())
        ).unique().all()
    else:
        tournaments = db.scalars(
            select(Tournament)
            .join(TournamentPlayer, TournamentPlayer.tournament_id == Tournament.id)
            .options(joinedload(Tournament.rounds).joinedload(Round.course))
            .where(TournamentPlayer.player_id == current_user.id)
            .order_by(Tournament.date.desc())
        ).unique().all()

    result: list[NavigationTournament] = []
    for tournament in tournaments:
        visible_rounds = sorted(tournament.rounds, key=lambda item: item.round_number)
        if current_user.role != UserRole.ADMIN:
            visible_rounds = [
                round_obj for round_obj in visible_rounds
                if _can_user_see_round(db, round_obj, current_user.id)
            ]
        result.append(
            NavigationTournament(
                id=tournament.id,
                name=tournament.name,
                date=tournament.date,
                rounds=[
                    NavigationRound(
                        id=round_obj.id,
                        round_number=round_obj.round_number,
                        name=round_obj.name,
                        date=round_obj.date,
                        status=round_obj.status,
                        course_name=round_obj.course.name,
                    )
                    for round_obj in visible_rounds
                ],
            )
        )
    return result


def _can_user_see_round(db: Session, round_obj: Round, user_id) -> bool:
    round_player_ids = db.scalars(select(RoundPlayer.player_id).where(RoundPlayer.round_id == round_obj.id)).all()
    return not round_player_ids or user_id in round_player_ids
