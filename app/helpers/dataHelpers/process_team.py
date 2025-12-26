from datetime import datetime, timedelta
import re
import logging
from aiohttp import ClientResponseError
from app.helpers.dataHelpers.outbound_api_request import fetch_data
from app.helpers.dataHelpers.update_stats_from_espn import update_stats_from_espn
from app.helpers.dataHelpers.calculate_team_index import calculate_base_index
from app.helpers.dataHelpers.db_setters.save_team_async import save_team_async
from app.helpers.config_helpers.espn_stat_config_map import statMap, new_statMap
from app.database.team_model import Teams

logger = logging.getLogger(__name__)

async def process_team(team, sport, upcoming_games, session, AsyncSessionLocal, stat_means, stat_stds):
    # logger.info(f"Processing team {team.teamName} ({sport.name})")
    team_stats_obj = team.currentStats or {}

    # Determine ESPN type
    month = datetime.now().strftime("%m")
    type = 2
    # if month == sport.startMonth:
    #     type = 1
    # elif month == sport.endMonth:
    #     type = 3

    # 1️⃣ Fetch record & update team stats
    record_url = (
        f"https://sports.core.api.espn.com/v2/sports/{sport.espnSport}/leagues/{sport.league}"
        f"/seasons/{sport.statYear}/types/{type}/teams/{team.espnID}/record?lang=en&region=us"
    )
    record_response = await fetch_data(record_url, session)
    if 'items' in record_response:
        for category in record_response['items']:
            
            name = category.get('name')
            
            if name == 'overall':
                team_stats_obj['seasonWinLoss'] = re.sub(r', \d+ PTS$', '', category['displayValue'])
                
                diff_stat = next((s for s in category["stats"] if s['name'] == 'pointDifferential'), None)
                if diff_stat:
                    team_stats_obj['pointDiff'] = diff_stat['value']
            elif name == 'Home':
                team_stats_obj['homeWinLoss'] = re.sub(r', \d+ PTS$', '', category['displayValue'])
                
            elif name == 'Away' or name == 'Road':
                team_stats_obj['awayWinLoss'] = re.sub(r', \d+ PTS$', '', category['displayValue'])

    # 2️⃣ Fetch general stats
    stats_url = (
        f"https://sports.core.api.espn.com/v2/sports/{sport.espnSport}/leagues/{sport.league}"
        f"/seasons/{sport.statYear}/types/{type}/teams/{team.espnID}/statistics?lang=en&region=us"
    )
    try:
        stat_response = await fetch_data(stats_url, session)
    except ClientResponseError as e:
        # async with AsyncSessionLocal() as session:
        #     team_to_delete = await session.get(Teams, team.id)
        #     if team_to_delete:
        #         await session.delete(team_to_delete)
        #         await session.commit()
        #         logger.info(f"Deleted team {team.id}")
        stat_response = None

    if stat_response and "splits" in stat_response:
        await update_stats_from_espn(stat_response["splits"], new_statMap[sport.name], team_stats_obj)

    # 3️⃣ Optional: Baseball-specific logic
    if sport.name == 'baseball_mlb':
         #Need helper function for updating team_stats with new stats
                if sport.name == 'baseball_mlb':
                    #Check for upcoming team_games in baseball
                    team_games = list(filter(lambda game: game.homeTeam == team.id or game.awayTeam == team.id, upcoming_games))
                    for game in team_games:
                        team_scoreboard_url_template = f"https://site.api.espn.com/apis/site/v2/sports/{sport.espnSport}/{sport.league}/teams/{team.espnID}/schedule"
                        team_scoreboard_response = await fetch_data(team_scoreboard_url_template)
                        if "events" in team_scoreboard_response:
                            team_scoreboard_match = None
                            matchup_template = f"{game.awayTeamDetails.espnDisplayName} at {game.homeTeamDetails.espnDisplayName}"
                            matchup_template_short = f"{game.awayTeamDetails.abbreviation} @ {game.homeTeamDetails.abbreviation}"
                            team_scoreboard_match = next((
                                g for g in team_scoreboard_response["events"]
                                if abs(datetime.fromisoformat(g["date"]) - game.commence_time) <= timedelta(minutes=90)
                                and (g["name"] == matchup_template or g["shortName"] == matchup_template_short)
                                ),
                                None  # default if no match found
                            )
                            if team_scoreboard_match is not None:
                                event_competitor = next((c for c in team_scoreboard_match["competitions"][0]["competitors"] if c["id"] == str(team.espnID)), None)
                                probable_pitcher = next((p for p in event_competitor["probables"] if p["abbreviation"] == 'SP'), None)
                                playerId = probable_pitcher["playerId"]
                                #fetch Pitcher's Individual Stats
                                pitcher_stats_url_template = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/2025/types/2/athletes/{playerId}/statistics?lang=en&region=us"
                                pitcher_stats_response = await fetch_data(pitcher_stats_url_template)
                                await update_stats_from_espn(pitcher_stats_response["splits"], new_statMap[sport.name], team_stats_obj)
                                #update pitcher's stats in db


    # 4️⃣ Compute and save base index
    team_base_index = calculate_base_index(team_stats_obj, sport.mlModelWeights.featureImportanceScoresTeam, stat_means, stat_stds)

    payload = {
        "statIndex": team_base_index,
        "currentStats": team_stats_obj
    }
    await save_team_async(team, payload, AsyncSessionLocal)
