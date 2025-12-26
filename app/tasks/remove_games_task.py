from app.celery_app.celery import celery
import logging
import asyncio
import json
from zoneinfo import ZoneInfo  # Python 3.9
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
import aiohttp
from app.database.game_model import Games  # Assuming your db object is imported from utils
from app.helpers.dataHelpers.outbound_api_request import fetch_data  # Your async API helper
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
from app.helpers.dataHelpers.db_setters.save_game_async import save_game_async

logger = logging.getLogger(__name__)


def format_espn_date(date_str: str) -> str:
    """Return ESPN-style YYYYMMDD string from ISO datetime."""
    return date_str.strftime("%Y%m%d")



@celery.task
def remove_games():
    asyncio.run(remove_games_async())


async def remove_games_async():
    """Fetch odds data from the API and save to the database."""
    AsyncSessionLocal, engine = get_async_session_factory()
    async with AsyncSessionLocal() as session:
        stmt = select(Games).where(Games.complete == False).options(
                selectinload(Games.homeTeamDetails),
                selectinload(Games.awayTeamDetails),
                selectinload(Games.homeStats),
                selectinload(Games.awayStats),
                selectinload(Games.sportDetails)
            )
        result = await session.execute(stmt)
        current_odds = result.scalars().all()

        current_odds = sorted(current_odds , key=lambda g: g.commence_time)

    async with aiohttp.ClientSession()  as session:

        """Update or remove games that have already started or finished."""

        for game in current_odds:
            commence_time = game.commence_time

            # Get Denver today
            now = datetime.now(ZoneInfo("America/Denver"))

            # Skip future games
            if commence_time >= now:
                continue

            home_team_id = game.homeTeam
            away_team_id = game.awayTeam

            if not (home_team_id and away_team_id):
                print(f"Missing team IDs for game {game.id}")
                continue

            try:
                # 1️⃣ Fetch home team schedule from ESPN API
                # schedule_url = (
                #     f"https://site.api.espn.com/apis/site/v2/sports/"
                #     f"{game.sportDetails.espnSport}/"
                #     f"{game.homeTeamDetails.espnLeague}/teams/"
                #     f"{game.homeTeamDetails.espnID}/schedule"
                # )

                # home_sched_json = await fetch_data(schedule_url, session)
                one_day_ago = commence_time - timedelta(days=1)
                two_days_out = commence_time + timedelta(days=2)
                start_date = format_espn_date(one_day_ago)
                end_date = format_espn_date(two_days_out)


                if game.sport_key == 'basketball_ncaab' or game.sport_key == 'basketball_wncaab':
                    scoreboard_url = (
                        f"https://site.api.espn.com/apis/site/v2/sports/"
                        f"{game.sportDetails.espnSport}/"
                        f"{game.homeTeamDetails.espnLeague}/scoreboard?"
                        f"groups=50&dates={start_date}-{end_date}"
                    )
                else:
                    scoreboard_url = (
                        f"https://site.api.espn.com/apis/site/v2/sports/"
                        f"{game.sportDetails.espnSport}/"
                        f"{game.homeTeamDetails.espnLeague}/scoreboard?"
                        f"dates={start_date}-{end_date}"
                    )

                scoreboard_json = await fetch_data(scoreboard_url, session)

                # 2️⃣ Find event matching our game
                game_time = commence_time
                events = scoreboard_json.get("events", [])
            
                event = next(
                    (
                        e for e in events
                            if (
                                e.get("name") == f"{game.awayTeamDetails.espnDisplayName} at {game.homeTeamDetails.espnDisplayName}"
                                or e.get("shortName") == f"{game.awayTeamDetails.abbreviation} @ {game.homeTeamDetails.abbreviation}"
                                or e.get("shortName") == f"{game.homeTeamDetails.abbreviation} @ {game.awayTeamDetails.abbreviation}"
                                or e.get("shortName") == f"{game.homeTeamDetails.abbreviation} VS {game.awayTeamDetails.abbreviation}"
                                or e.get("shortName") == f"{game.awayTeamDetails.abbreviation} VS {game.homeTeamDetails.abbreviation}"
                            ) 
                            # and (
                            #     game.sport_key != "baseball_mlb" 
                            #     or abs((datetime.fromisoformat(e["date"]) - game_time).total_seconds()) <= 7200
                            #     )
                    ),
                    None,
                )
                if not event:
                    print(f"No matching event found for game {game.id}")
                    print(f"{game.awayTeamDetails.espnDisplayName} at {game.homeTeamDetails.espnDisplayName}")
                    print(scoreboard_url)
                    # async with AsyncSessionLocal() as session:
                    #     game_to_delete = await session.get(Games, game.id)
                    #     if game_to_delete:
                    #         await session.delete(game_to_delete)
                    #         await session.commit()
                    #         logger.info(f"Deleted game {game.id}")

                    continue

                comp = event["competitions"][0]
                status = comp["status"]["type"]
                # 3️⃣ Handle completed games
                if status.get("completed") is True:
                    home_score = away_score = None
                    for team in comp["competitors"]:
                        if int(team['id']) == game.homeTeamDetails.espnID:
                            home_score = int(team['score'])
                        elif int(team['id']) == game.awayTeamDetails.espnID:
                            away_score = int(team['score'])
                        else:
                            logger.info(f"NO MATCHING TEAM FOUND {scoreboard_url}")

                    winner = "home" if home_score > away_score else "away"
                    prediction_correct = (
                        game.predictedWinner == winner
                    )
                    payload =    {
                            "homeScore": home_score,
                            "awayScore": away_score,
                            "timeRemaining": None,
                            "predictionCorrect": prediction_correct,
                            "winner": winner,
                            "complete": True,
                        }
                    await save_game_async(game, payload, AsyncSessionLocal, game.sportDetails, False)
                # 4️⃣ Handle in-progress games
                elif status.get("description") in ("In Progress", "Halftime", "End of Period"):


                    # scoreboard_url = (
                    #     f"https://site.api.espn.com/apis/site/v2/sports/"
                    #     f"{game.sportDetails.espnSport}/"
                    #     f"{game.homeTeamDetails.espnLeague}/scoreboard?"
                    #     f"dates={start_date}-{end_date}"
                    # )

                    # scoreboard_json = await fetch_data(scoreboard_url, session)
                    sb_event = next((ev for ev in scoreboard_json['events'] if ev["id"] == event["id"]), None)

                    if not sb_event:
                        print(f"No scoreboard event found for in-progress game {game.id}")
                        print(f"{game.awayTeamDetails.espnDisplayName} at {game.homeTeamDetails.espnDisplayName}")
                        print(scoreboard_url)
                        continue

                    comp = sb_event["competitions"][0]
                    home_score = away_score = None
                    for team in comp["competitors"]:
                        if int(team['id']) == game.homeTeamDetails.espnID:
                            home_score = int(team['score'])
                        elif int(team['id']) == game.awayTeamDetails.espnID:
                            away_score = int(team['score'])
                        else:
                            logger.info(f"NO MATCHING TEAM FOUND {scoreboard_url}")

                    time_remaining = sb_event["status"]["type"].get("shortDetail")

                    try:
                        payload = {
                            "homeScore": home_score,
                            "awayScore": away_score,
                            "timeRemaining": time_remaining,
                        }
                        await save_game_async(game, payload, AsyncSessionLocal, game.sportDetails, False)
                    except Exception as e:
                        print(f"Error updating in-progress game {game.id}: {e}")

                # 5️⃣ Handle postponed games
                elif status.get("description") == "Postponed":
                    print(f"Game Postponed: {game.id}")
                    print(f"{game.awayTeamDetails.espnDisplayName} at {game.homeTeamDetails.espnDisplayName}")
                    print(scoreboard_url)

            except Exception as e:
                logger.info(e)
                print(f"Error processing game {game.id}: {e}")
                print(f"{game.awayTeamDetails.espnDisplayName} at {game.homeTeamDetails.espnDisplayName}")
                print(scoreboard_url)
                continue





        logger.info("THIS IS WHEN GAMES GET REMOVED")