from __future__ import annotations

import argparse
import uuid
from dataclasses import dataclass

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.entities import BonusRule, Tournament, User
from app.models.enums import BonusAnimationPreset, ScopeType, UserRole
from app.services.rules import validate_rule_definition


@dataclass(frozen=True)
class SuggestedBonusRule:
    name: str
    points: int
    winner_message: str
    definition: dict


SUGGESTED_BONUS_RULES = [
    SuggestedBonusRule(
        "Comeback Koning",
        5,
        "Vier of meer Stableford-punten beter dan je vorige ronde. De comeback leeft.",
        {
            "op": "and",
            "conditions": [
                {"field": "round_number", "operator": "gte", "value": 2},
                {"field": "round_stableford_delta_prev", "operator": "gte", "value": 4},
            ],
        },
    ),
    SuggestedBonusRule(
        "Laatste Dag Lifter",
        6,
        "Buiten de top drie en toch een sterke finaleronde. Precies de chaos die we nodig hebben.",
        {
            "op": "and",
            "conditions": [
                {"field": "is_final_round", "operator": "eq", "value": True},
                {"field": "is_outside_top3_before_round", "operator": "eq", "value": True},
                {"field": "round_stableford", "operator": "gte", "value": 18},
            ],
        },
    ),
    SuggestedBonusRule(
        "Onderste Helft Bonus",
        4,
        "Gestart in de onderste helft en toch een nette ronde neergezet. Het toernooi blijft open.",
        {
            "op": "and",
            "conditions": [
                {"field": "is_bottom_half_before_round", "operator": "eq", "value": True},
                {"field": "round_stableford", "operator": "gte", "value": 16},
            ],
        },
    ),
    SuggestedBonusRule(
        "Stableford Vonk",
        4,
        "Achttien of meer Stableford-punten in een ronde. De kaart staat officieel in brand.",
        {"field": "round_stableford", "operator": "gte", "value": 18},
    ),
    SuggestedBonusRule(
        "Par 3 Specialist",
        3,
        "Sterk op de par 3 holes. Klein werk, grote punten.",
        {"field": "round_par3_stableford", "operator": "gte", "value": 6},
    ),
    SuggestedBonusRule(
        "Lange Hole Totaalheld",
        3,
        "Goed gescoord op de lange holes. Dat is geen toeval meer.",
        {"field": "round_long_hole_stableford", "operator": "gte", "value": 6},
    ),
    SuggestedBonusRule(
        "Back Nine Beest",
        3,
        "Tien of meer Stableford-punten op de tweede negen. Sterk uitgespeeld.",
        {"field": "back_nine_stableford", "operator": "gte", "value": 10},
    ),
    SuggestedBonusRule(
        "Front Nine Vlieger",
        3,
        "Tien of meer Stableford-punten op de eerste negen. Meteen wakker.",
        {"field": "front_nine_stableford", "operator": "gte", "value": 10},
    ),
    SuggestedBonusRule(
        "Netto Par Machine",
        2,
        "Drie netto pars op rij. Saai golf, heerlijke punten.",
        {"field": "round_net_par_streak", "operator": "gte", "value": 3},
    ),
    SuggestedBonusRule(
        "Bogey Bandiet",
        2,
        "Veel bogeys, maar nog steeds blijven scoren. Rommelig, maar effectief.",
        {
            "op": "and",
            "conditions": [
                {"field": "round_bogey_holes", "operator": "gte", "value": 4},
                {"field": "round_stableford", "operator": "gte", "value": 14},
            ],
        },
    ),
    SuggestedBonusRule(
        "Sneeuwman Survivor",
        2,
        "Acht of meer slagen op een hole. Pijn erkend, bonus verdiend.",
        {"field": "strokes", "operator": "gte", "value": 8},
    ),
    SuggestedBonusRule(
        "Geen Nul Club",
        5,
        "Geen enkele nul op de kaart. Dat is weekendgolf met volwassen trekjes.",
        {
            "op": "and",
            "conditions": [
                {"field": "round_holes_played", "operator": "gte", "value": 9},
                {"field": "round_zero_stableford_holes", "operator": "eq", "value": 0},
            ],
        },
    ),
    SuggestedBonusRule(
        "Schadebeperking",
        3,
        "Maximaal een nul in de ronde. De schade bleef netjes beperkt.",
        {
            "op": "and",
            "conditions": [
                {"field": "round_holes_played", "operator": "gte", "value": 9},
                {"field": "round_zero_stableford_holes", "operator": "lte", "value": 1},
            ],
        },
    ),
    SuggestedBonusRule(
        "Vierpunten Vuur",
        3,
        "Vier of meer Stableford-punten op een hole. Dat is vuurwerk.",
        {"field": "stableford_points", "operator": "gte", "value": 4},
    ),
    SuggestedBonusRule(
        "Terugvecht Hole",
        3,
        "Na een nul direct terug met twee of meer punten. Hoofd omhoog.",
        {
            "op": "and",
            "conditions": [
                {"field": "previous_hole_stableford", "operator": "eq", "value": 0},
                {"field": "stableford_points", "operator": "gte", "value": 2},
            ],
        },
    ),
    SuggestedBonusRule(
        "Birdie Sap",
        3,
        "Birdie of beter. Daar mag best even over gepraat worden.",
        {"field": "gross_to_par", "operator": "lte", "value": -1},
    ),
    SuggestedBonusRule(
        "Lange Hole Held",
        2,
        "Netto par of beter op een lange hole. Die telt extra lekker.",
        {
            "op": "and",
            "conditions": [
                {"field": "distance", "operator": "gte", "value": 350},
                {"field": "net_to_par", "operator": "lte", "value": 0},
            ],
        },
    ),
    SuggestedBonusRule(
        "Handicap Held",
        4,
        "Hoge handicap, sterke ronde. Precies waarvoor het systeem bestaat.",
        {
            "op": "and",
            "conditions": [
                {"field": "player_hcp", "operator": "gte", "value": 18},
                {"field": "round_stableford", "operator": "gte", "value": 16},
            ],
        },
    ),
    SuggestedBonusRule(
        "Finale Chaos Bonus",
        4,
        "Drie of meer Stableford-punten op een hole in de finaleronde. Laatste dag, alles mag.",
        {
            "op": "and",
            "conditions": [
                {"field": "is_final_round", "operator": "eq", "value": True},
                {"field": "stableford_points", "operator": "gte", "value": 3},
            ],
        },
    ),
    SuggestedBonusRule(
        "Aanval Buiten Top 3",
        5,
        "Buiten de top drie gestart en duidelijk beter dan je vorige ronde. De achtervolging is aan.",
        {
            "op": "and",
            "conditions": [
                {"field": "is_outside_top3_before_round", "operator": "eq", "value": True},
                {"field": "round_stableford_delta_prev", "operator": "gte", "value": 3},
            ],
        },
    ),
    SuggestedBonusRule(
        "Onderste Helft Raket",
        5,
        "Vanuit de onderste helft ineens gelanceerd. Dit klassement is nog niet klaar.",
        {
            "op": "and",
            "conditions": [
                {"field": "is_bottom_half_before_round", "operator": "eq", "value": True},
                {"field": "round_stableford_delta_prev", "operator": "gte", "value": 4},
            ],
        },
    ),
    SuggestedBonusRule(
        "Meest Verbeterde Ronde",
        5,
        "Minstens vijf Stableford-punten beter dan de vorige ronde. Dat is groei.",
        {"field": "round_stableford_delta_prev", "operator": "gte", "value": 5},
    ),
    SuggestedBonusRule(
        "Weekend Strijder",
        3,
        "Opnieuw beter dan de vorige ronde. Het weekend komt op gang.",
        {
            "op": "and",
            "conditions": [
                {"field": "round_number", "operator": "gte", "value": 2},
                {"field": "round_stableford_delta_prev", "operator": "gte", "value": 2},
            ],
        },
    ),
    SuggestedBonusRule(
        "Nooit Opgeven",
        4,
        "Na een zware vorige ronde toch terug met zestien of meer punten. Niet opgeven betaalt uit.",
        {
            "op": "and",
            "conditions": [
                {"field": "previous_round_stableford", "operator": "lte", "value": 12},
                {"field": "round_stableford", "operator": "gte", "value": 16},
            ],
        },
    ),
    SuggestedBonusRule(
        "Jacht op de Leider",
        4,
        "Niet als leider gestart, wel twintig of meer Stableford-punten gemaakt. Druk erop.",
        {
            "op": "and",
            "conditions": [
                {"field": "tournament_position_before_round", "operator": "gt", "value": 1},
                {"field": "round_stableford", "operator": "gte", "value": 20},
            ],
        },
    ),
    SuggestedBonusRule(
        "Chaos-Hole Bonus",
        3,
        "Drie of meer punten op een vooraf gekozen chaos-hole. Heerlijk onnodig belangrijk.",
        {
            "op": "and",
            "conditions": [
                {"field": "hole_number", "operator": "in", "value": [3, 7, 13, 17]},
                {"field": "stableford_points", "operator": "gte", "value": 3},
            ],
        },
    ),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed the suggested Dutch bonus rules into a tournament.")
    parser.add_argument("--tournament-id", help="Tournament UUID to seed. Defaults to latest tournament by date.")
    parser.add_argument("--tournament-name", help="Tournament name to seed. Case-insensitive exact match.")
    parser.add_argument("--update-existing", action="store_true", help="Update existing rules with matching names.")
    parser.add_argument("--admin-username", help="Admin username to mark as creator/updater. Defaults to first admin.")
    return parser.parse_args()


def find_tournament(db, args: argparse.Namespace) -> Tournament:
    if args.tournament_id:
        tournament_id = uuid.UUID(args.tournament_id)
        tournament = db.scalar(select(Tournament).where(Tournament.id == tournament_id))
    elif args.tournament_name:
        tournament = db.scalar(select(Tournament).where(Tournament.name.ilike(args.tournament_name)))
    else:
        tournament = db.scalar(select(Tournament).order_by(Tournament.date.desc(), Tournament.created_at.desc()))
    if not tournament:
        raise RuntimeError("Tournament not found")
    return tournament


def find_admin(db, username: str | None) -> User:
    statement = select(User).where(User.role == UserRole.ADMIN)
    if username:
        statement = statement.where(User.username == username.lower())
    admin = db.scalar(statement.order_by(User.created_at.asc()))
    if not admin:
        raise RuntimeError("Admin user not found")
    return admin


def main() -> None:
    args = parse_args()
    with SessionLocal() as db:
        tournament = find_tournament(db, args)
        admin = find_admin(db, args.admin_username)
        created = []
        updated = []
        skipped = []

        for suggested in SUGGESTED_BONUS_RULES:
            validate_rule_definition(suggested.definition)
            existing = db.scalar(
                select(BonusRule).where(
                    BonusRule.tournament_id == tournament.id,
                    BonusRule.scope_type == ScopeType.TOURNAMENT,
                    BonusRule.name == suggested.name,
                )
            )
            if existing:
                if args.update_existing:
                    existing.points = suggested.points
                    existing.winner_message = suggested.winner_message
                    existing.definition_jsonb = suggested.definition
                    existing.animation_preset = BonusAnimationPreset.CONFETTI
                    existing.animation_lottie_url = None
                    existing.enabled = True
                    existing.updated_by_user_id = admin.id
                    updated.append(suggested.name)
                else:
                    skipped.append(suggested.name)
                continue

            db.add(
                BonusRule(
                    name=suggested.name,
                    scope_type=ScopeType.TOURNAMENT,
                    tournament_id=tournament.id,
                    round_id=None,
                    points=suggested.points,
                    winner_message=suggested.winner_message,
                    definition_jsonb=suggested.definition,
                    animation_preset=BonusAnimationPreset.CONFETTI,
                    animation_lottie_url=None,
                    enabled=True,
                    created_by_user_id=admin.id,
                    updated_by_user_id=admin.id,
                )
            )
            created.append(suggested.name)

        db.commit()
        print(f"Seeded suggested bonus rules for tournament: {tournament.name} ({tournament.id})")
        print(f"Created: {len(created)}")
        print(f"Updated: {len(updated)}")
        print(f"Skipped: {len(skipped)}")
        if created:
            print("Created rules:")
            for name in created:
                print(f"  - {name}")
        if updated:
            print("Updated rules:")
            for name in updated:
                print(f"  - {name}")
        if skipped:
            print("Skipped existing rules:")
            for name in skipped:
                print(f"  - {name}")


if __name__ == "__main__":
    main()
