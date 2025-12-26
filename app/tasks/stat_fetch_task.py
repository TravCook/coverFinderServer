from app.celery_app.celery import celery
from app.helpers.dataHelpers.db_getters.get_sports_sync import get_sports_sync
from app.helpers.dataHelpers.db_getters.get_teams_by_sport import get_teams_by_sport
from app.helpers.dataHelpers.db_getters.get_games_sync import get_upcoming_games_sync
from app.helpers.dataHelpers.sport_in_season import sport_in_season
from app.helpers.dataHelpers.process_team import process_team
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
from app.helpers.dataHelpers.db_setters.scale_and_save_team import scale_and_save_team
from app.helpers.dataHelpers.calculate_team_index import parse_stat_value
import logging
import asyncio
import aiohttp
import numpy as np
logger = logging.getLogger(__name__)

@celery.task
def fetch_team_stats():
    asyncio.run(fetch_team_stats_async())

async def fetch_team_stats_async():
     # ✅ create engine + session factory INSIDE the task
    AsyncSessionLocal, engine = get_async_session_factory()

    all_sports = await get_sports_sync(AsyncSessionLocal)  # pass session factory down

    async with aiohttp.ClientSession() as session:
        for sport in all_sports:
            logger.info(f"STARTING TEAM SEEDING FOR {sport.name}")
            if not sport_in_season(sport):
                logger.info(f"{sport.name} is not in season")
                continue

            sport_teams = await get_teams_by_sport(sport, AsyncSessionLocal)
            upcoming_games = await get_upcoming_games_sync(sport, AsyncSessionLocal)

            # Precompute league-wide means and stds for all features in feature_importances
            stat_means = {}
            stat_stds = {}

            for feature in sport.mlModelWeights.featureImportanceScoresTeam:
                name = feature["feature"]
                # Gather values from all teams
                all_values = []
                for team in sport_teams:
                    val = team.currentStats.get(name)
                    val = parse_stat_value(val)
                    all_values.append(val)

                if all_values:
                    stat_means[name] = np.mean(all_values)
                    stat_stds[name] = np.std(all_values, ddof=0)
                else:
                    stat_means[name] = 0
                    stat_stds[name] = 1  # Avoid division by zero

            # Run all team updates concurrently
            await asyncio.gather(*[
                process_team(team, sport, upcoming_games, session, AsyncSessionLocal, stat_means, stat_stds)
                for team in sport_teams
            ])

            # Re-fetch for scaled index calculation
            sport_teams = await get_teams_by_sport(sport, AsyncSessionLocal)

            # Scale all teams concurrently
            await asyncio.gather(*[
                scale_and_save_team(team, sport, sport_teams, AsyncSessionLocal)
                for team in sport_teams
            ])

            logger.info(f"ENDING TEAM SEEDING FOR {sport.name}")

    await engine.dispose()
