from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
from app.helpers.dataHelpers.db_getters.get_teams_by_sport import get_teams_by_sport
from app.helpers.dataHelpers.db_getters.get_sports_sync import get_sports_sync
from app.helpers.dataHelpers.update_stats_from_espn import update_stats_from_espn_past
from app.helpers.dataHelpers.db_setters.save_game_async import save_game_async
from app.helpers.dataHelpers.db_setters.save_stats_async import save_stats_async
import aiohttp
import logging
from datetime import datetime
from collections import Counter, defaultdict
from app.helpers.dataHelpers.outbound_api_request import fetch_data
from app.helpers.config_helpers.espn_stat_config_map import statMap, new_statMap
from app.helpers.config_helpers.stat_config import stat_config_map
logger = logging.getLogger(__name__)
async def past_game_data_builder():
    """Build past game data for model training."""

    AsyncSessionLocal, engine = get_async_session_factory()
    sports = await get_sports_sync(AsyncSessionLocal)
    solved_stats =['gamesPlayed']
    for sport in sports:
            logger.info(f"Building past game data for sport: {sport.name}")
            sport_teams = await get_teams_by_sport(sport, AsyncSessionLocal)
            # iterate over years
            async with aiohttp.ClientSession() as session:
                for year in range(sport.statYear - 5, sport.statYear + 1):
                    team_history = {
                        team_id: {
                            "stats": {
                                **{key: 0 for key in stat_config_map[sport.name]['default']},
                                "seasonWinLoss": "0-0",
                                "awayWinLoss": "0-0",
                                "homeWinLoss": "0-0",
                            }
                        }
                        for team_id in [t.espnID for t in sport_teams]
                    }


                    processed_games = set()
                    games=[]
                    # BUILD PARENT LIST OF GAMES PROCESSED FOR EACH TEAM TO AVOID DUPLICATES
                    for team in sport_teams:
                        schedule_url = (f"https://site.api.espn.com/apis/site/v2/sports/{sport.espnSport}/{sport.league}/teams/{team.espnID}/schedule?season={year}&seasontype=2")
                        schedule_response = await fetch_data(schedule_url, session)
                        if schedule_response['events']:
                            for game in schedule_response['events']:
                                if game['id'] in processed_games:
                                    continue
                                if game['competitions'][0]['status']['type']['name'] == 'STATUS_FINAL':
                                    processed_games.add(game['id'])
                                    games.append(game)
                        playoff_schedule_url = (f"https://site.api.espn.com/apis/site/v2/sports/{sport.espnSport}/{sport.league}/teams/{team.espnID}/schedule?season={year}&seasontype=3")
                        playoff_schedule_response = await fetch_data(playoff_schedule_url, session)
                        if playoff_schedule_response['events']:
                            for game in playoff_schedule_response['events']:
                                if game['id'] in processed_games:
                                    continue
                                if game['competitions'][0]['status']['type']['name'] == 'STATUS_FINAL':
                                    processed_games.add(game['id'])
                                    games.append(game)
                    logger.info(f"Total unique games fetched for {sport.name} in {year}: {len(games)}")
                    sorted_games = sorted(games, key=lambda x: x['date'])
                    logger.info(F"Dates range from {sorted_games[0]['date']} to {sorted_games[-1]['date']}")
                    bad_data_games = 0

                    for game in sorted_games:
                        # things needed for each game for training
                        home_team = next((t for t in game['competitions'][0]['competitors'] if t['homeAway'] == 'home'), None)
                        away_team = next((t for t in game['competitions'][0]['competitors'] if t['homeAway'] == 'away'), None)

                        if not home_team or not away_team:
                            bad_data_games += 1
                            logger.warning(f"Skipping game {game['id']} due to missing team data.")
                            continue

                        
                        if 'winner' not in home_team or 'winner' not in away_team:
                            bad_data_games += 1
                            logger.info(f"{game['id']} missing winner data, skipping.")
                            continue


                        home_score = home_team['score']['value']
                        away_score = away_team['score']['value']
                        winner = 'home' if home_team['winner'] == True else 'away'

                        if home_score is None or away_score is None:
                            bad_data_games += 1
                            logger.info(f"Skipping game {game['id']} due to missing score data.")
                            continue


                        home_stat_url = (F"https://sports.core.api.espn.com/v2/sports/{sport.espnSport}/leagues/{sport.league}/events/{game['id']}/competitions/{game['id']}/competitors/{home_team['id']}/statistics")
                        away_stat_url = (F"https://sports.core.api.espn.com/v2/sports/{sport.espnSport}/leagues/{sport.league}/events/{game['id']}/competitions/{game['id']}/competitors/{away_team['id']}/statistics")
                        # logger.info(home_stat_url)
                        home_stat_response = await fetch_data(home_stat_url, session)
                        away_stat_response = await fetch_data(away_stat_url, session)
                        home_team_stats = home_stat_response['splits'] if 'splits' in home_stat_response else []
                        away_team_stats = away_stat_response['splits'] if 'splits' in away_stat_response else []
                        if not home_team_stats or not away_team_stats:
                            bad_data_games += 1
                            # if not home_team_stats:
                            #     logger.info(F"NO STATS FOUND FOR https://sports.core.api.espn.com/v2/sports/{sport.espnSport}/leagues/{sport.league}/events/{game['id']}/competitions/{game['id']}/competitors/{home_team['id']}/statistics")
                            # if not away_team_stats:
                            #     logger.info(F"NO STATS FOUND FOR https://sports.core.api.espn.com/v2/sports/{sport.espnSport}/leagues/{sport.league}/events/{game['id']}/competitions/{game['id']}/competitors/{away_team['id']}/statistics")
                            continue
                            
                        
                        home_team_id = int(home_team['id'])
                        away_team_id = int(away_team['id'])

                        if home_team_id not in team_history or away_team_id not in team_history:
                            if home_team_id == 24 and sport.name == "icehockey_nhl":
                                home_team_id = 129764 # fix for coyotes change to mammoth
                            elif away_team_id == 24 and sport.name == "icehockey_nhl":
                                away_team_id = 129764 # fix for coyotes change to mammoth
                            else:
                                bad_data_games += 1
                                # logger.info(f"Skipping game {game['id']} team not in db.")
                                continue
                    
                        # use statmap to create stat dicts for each team
                        db_date = datetime.fromisoformat(game["date"].replace("Z", "+00:00"))

                        game_save_payload = {
                            "oddsApiID": game['id'],
                            "sport_key": sport.name,
                            "sport_title": sport.league,
                            "sport": sport.id,
                            "homeTeam": next((t.id for t in sport_teams if t.espnID == home_team_id), None),
                            "awayTeam": next((t.id for t in sport_teams if t.espnID == away_team_id), None),
                            "homeScore": home_score,
                            "awayScore": away_score,
                            "winner": winner,
                            "commence_time": db_date,
                            "complete": True
                        }

                        saved_game_id = await save_game_async(game, game_save_payload, AsyncSessionLocal, sport.name, False)

                        home_stats_dict = team_history[home_team_id]['stats']
                        away_stats_dict = team_history[away_team_id]['stats']

                        home_stat_payload = {
                            "gameId": saved_game_id,
                            "teamId": next((t.id for t in sport_teams if t.espnID == home_team_id), None),
                            "sport": sport.id,
                            "data": home_stats_dict
                        }
                        away_stat_payload = {
                            "gameId": saved_game_id,
                            "teamId": next((t.id for t in sport_teams if t.espnID == away_team_id), None),
                            "sport": sport.id,
                            "data": away_stats_dict
                        }

                        await save_stats_async(away_team, away_stat_payload, AsyncSessionLocal)

                        await save_stats_async(home_team, home_stat_payload, AsyncSessionLocal)


                        #UPDATE WIN/LOSS AND POINTDIFF HERE
                        def parse_winloss(s):
                            wins, losses = s.split('-')
                            return int(wins), int(losses)

                        if winner == 'home':

                            # HOME WINS
                            season_wins_home, season_losses_home = parse_winloss(home_stats_dict['seasonWinLoss'])
                            home_wins_home, home_losses_home = parse_winloss(home_stats_dict['homeWinLoss'])

                            season_wins_home += 1
                            home_wins_home += 1

                            home_stats_dict['seasonWinLoss'] = f"{season_wins_home}-{season_losses_home}"
                            home_stats_dict['homeWinLoss'] = f"{home_wins_home}-{home_losses_home}"

                            # AWAY LOSES
                            season_wins_away, season_losses_away = parse_winloss(away_stats_dict['seasonWinLoss'])
                            away_wins_away, away_losses_away = parse_winloss(away_stats_dict['awayWinLoss'])

                            season_losses_away += 1
                            away_losses_away += 1

                            away_stats_dict['seasonWinLoss'] = f"{season_wins_away}-{season_losses_away}"
                            away_stats_dict['awayWinLoss'] = f"{away_wins_away}-{away_losses_away}"


                        elif winner == 'away':

                            # AWAY WINS
                            season_wins_away, season_losses_away = parse_winloss(away_stats_dict['seasonWinLoss'])
                            away_wins_away, away_losses_away = parse_winloss(away_stats_dict['awayWinLoss'])

                            season_wins_away += 1
                            away_wins_away += 1

                            away_stats_dict['seasonWinLoss'] = f"{season_wins_away}-{season_losses_away}"
                            away_stats_dict['awayWinLoss'] = f"{away_wins_away}-{away_losses_away}"

                            # HOME LOSES
                            season_wins_home, season_losses_home = parse_winloss(home_stats_dict['seasonWinLoss'])
                            home_wins_home, home_losses_home = parse_winloss(home_stats_dict['homeWinLoss'])

                            season_losses_home += 1
                            home_losses_home += 1

                            home_stats_dict['seasonWinLoss'] = f"{season_wins_home}-{season_losses_home}"
                            home_stats_dict['homeWinLoss'] = f"{home_wins_home}-{home_losses_home}"

                        # Point differential
                        home_stats_dict['pointDiff'] += (home_score - away_score)
                        away_stats_dict['pointDiff'] += (away_score - home_score)

                        # logger.info(f"===========================HOME STATS BEFORE UPDATING=============================")

                        # for stat in home_stats_dict:
                        #     logger.info(f"{stat}: {home_stats_dict[stat]}")

                        home_stats_updated = await update_stats_from_espn_past(home_team_stats, new_statMap[sport.name], home_stats_dict)
                        away_stats_updated = await update_stats_from_espn_past(away_team_stats, new_statMap[sport.name], away_stats_dict)

                        
                        # logger.info(f"===========================HOME STATS after UPDATING=============================")

                        # for stat in home_stats_dict:
                        #     logger.info(f"{stat}: {home_stats_dict[stat]}")

                        # after saving, update team_history with new stats
                        team_history[home_team_id]['stats'] = home_stats_updated
                        team_history[away_team_id]['stats'] = away_stats_updated

                    logger.info(f"Completed building past game data for sport: {sport.name} in year: {year} with {bad_data_games} {bad_data_games / len(games) * 100:.2f}% games skipped due to bad data.")
