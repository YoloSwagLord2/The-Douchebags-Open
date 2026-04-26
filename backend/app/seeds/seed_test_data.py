from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.entities import Course, Hole, Tournament, TournamentPlayer, Round, User, Score
from app.models.enums import UserRole, RoundStatus, ScoreChangeSource
from app.services.auth import hash_password
import random


def main() -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        # Check if test data already exists
        existing = db.scalar(select(User).where(User.email == "player1@test.com"))
        if existing:
            print("Test data already exists")
            return

        # Create test players
        players = []
        player_data = [
            ("Alice Johnson", "alice@test.com", 8.5),
            ("Bob Smith", "bob@test.com", 12.3),
            ("Charlie Brown", "charlie@test.com", 5.2),
            ("Diana Prince", "diana@test.com", 15.8),
            ("Eve Wilson", "eve@test.com", 10.1),
            ("Frank Miller", "frank@test.com", 18.5),
            ("Grace Lee", "grace@test.com", 7.2),
            ("Henry Davis", "henry@test.com", 14.6),
        ]

        for name, email, hcp in player_data:
            username = email.lower().split("@")[0]
            player = User(
                name=name,
                username=username,
                email=email.lower(),
                password_hash=hash_password("password123"),
                hcp=hcp,
                role=UserRole.PLAYER,
                is_active=True,
            )
            players.append(player)
            db.add(player)

        db.flush()
        print(f"Created {len(players)} test players")

        # Create courses with holes
        courses = []
        course_data = [
            ("Pebble Beach", 145, 74.5),
            ("Augusta National", 152, 76.3),
            ("St. Andrews", 148, 74.8),
        ]

        for course_name, slope, rating in course_data:
            course = Course(
                name=course_name,
                slope_rating=slope,
                course_rating=rating,
            )
            db.add(course)
            db.flush()

            # Add 18 holes to each course
            par_sequence = [4, 3, 4, 5, 4, 3, 4, 4, 5, 4, 3, 4, 5, 4, 3, 4, 4, 5]
            distances = [400, 180, 390, 540, 420, 170, 410, 430, 560, 430, 160, 400, 550, 410, 190, 420, 450, 580]

            for hole_num in range(1, 19):
                hole = Hole(
                    course_id=course.id,
                    hole_number=hole_num,
                    par=par_sequence[hole_num - 1],
                    stroke_index=hole_num,
                    distance=distances[hole_num - 1],
                )
                db.add(hole)

            courses.append(course)

        db.flush()
        print(f"Created {len(courses)} courses with 18 holes each")

        # Create tournaments (events)
        tournaments = []
        today = date.today()
        tournament_dates = [
            today + timedelta(days=7),
            today + timedelta(days=14),
            today + timedelta(days=21),
        ]

        tournament_names = [
            "Spring Championship",
            "Summer Open",
            "Fall Classic",
        ]

        for name, event_date in zip(tournament_names, tournament_dates):
            tournament = Tournament(
                name=name,
                date=event_date,
            )
            db.add(tournament)
            db.flush()
            tournaments.append(tournament)

            # Add players to tournament
            tournament_players = random.sample(players, k=random.randint(6, 8))
            for player in tournament_players:
                tp = TournamentPlayer(
                    tournament_id=tournament.id,
                    player_id=player.id,
                )
                db.add(tp)

            db.flush()

            # Create 2 rounds for each tournament
            for round_num in range(1, 3):
                round_course = random.choice(courses)
                round_date = event_date + timedelta(days=round_num - 1)
                round_obj = Round(
                    tournament_id=tournament.id,
                    course_id=round_course.id,
                    round_number=round_num,
                    date=round_date,
                    status=RoundStatus.OPEN if round_num == 1 else RoundStatus.OPEN,
                )
                db.add(round_obj)
                db.flush()

                # Add some sample scores for round 1
                if round_num == 1:
                    for player in tournament_players:
                        for hole in round_course.holes:
                            # Score around par with some variation
                            strokes = hole.par + random.randint(-1, 3)
                            score = Score(
                                round_id=round_obj.id,
                                player_id=player.id,
                                hole_id=hole.id,
                                strokes=strokes,
                                updated_by_user_id=players[0].id,  # Admin user
                            )
                            db.add(score)

        db.commit()
        print(f"Created {len(tournaments)} tournaments with rounds and sample scores")
        print("\nTest data seeded successfully!")
        print("\nTest login credentials:")
        for name, email, _ in player_data[:3]:
            print(f"  {name}: {email} / password123")

    except Exception as e:
        db.rollback()
        print(f"Error seeding test data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
