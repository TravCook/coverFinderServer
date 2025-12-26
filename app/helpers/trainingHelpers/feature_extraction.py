from pprint import pformat
from app.helpers.dataHelpers.is_valid_stat_block import is_valid_stat_block
import logging
import math
import pprint
from datetime import datetime
from app.helpers.config_helpers.stat_config import stat_config_map
import numpy as np  # For trend calculations

def to_number(x):
    if isinstance(x, (int, float)):
        return 0.0 if isinstance(x, float) and math.isnan(x) else x
    if isinstance(x, str):
        import re
        m = re.search(r"-?\d+\.?\d*", x)
        return float(m.group()) if m else 0.0
    return 0.0

def rest_days(team_id, current_game, last_games_info):
    games = last_games_info.get(team_id, [])
    if not games:
        return 0
    last_date = games[-1][0]
    return max(0, (current_game.commence_time - last_date).days)

def calc_streak(scores):
    if not scores:
        return 0
    streak = 1
    for i in range(len(scores)-2, -1, -1):
        if scores[i+1] > scores[i]:
            streak += 1
        else:
            break
    return streak

# ---- Opponent-specific score feature generator ----
def get_vs_opp_features(team_id, opp_id, team_vs_team_history):
    meetings = team_vs_team_history.get(team_id, {}).get(opp_id, [])
    if not meetings:
        return {
            "avg_score_vs_opp_last5": 0.0,
            "avg_score_vs_opp_last10": 0.0,
            "avg_score_vs_opp_all": 0.0,
            "avg_points_allowed_vs_opp_last5": 0.0,
            "avg_points_allowed_vs_opp_last10": 0.0,
            "avg_points_allowed_vs_opp_all": 0.0,
            "score_trend_vs_opp_last5": 0.0,
            "score_std_vs_opp_last5": 0.0,
            "score_diff_vs_opp_last": 0.0,
            "avg_score_diff_vs_opp_last5": 0.0,
            "wins_vs_opp_last5": 0,
            "wins_vs_opp_last10": 0,
            "win_rate_vs_opp_all": 0.0
        }

    scores = [m["team_score"] for m in meetings]
    opp_scores = [m["opp_score"] for m in meetings]
    last5 = scores[-5:]
    last10 = scores[-10:]
    last5_opp = opp_scores[-5:]
    last10_opp = opp_scores[-10:]

    # Trends & Volatility
    if len(last5) >= 2:
        trend = np.polyfit(range(len(last5)), last5, 1)[0]
        std_last5 = np.std(last5)
    else:
        trend = 0.0
        std_last5 = 0.0

    diffs = [s - o for s, o in zip(scores, opp_scores)]
    wins = [1 if d > 0 else 0 for d in diffs]

    return {
        "avg_score_vs_opp_last5": np.mean(last5) if last5 else 0.0,
        "avg_score_vs_opp_last10": np.mean(last10) if last10 else 0.0,
        "avg_score_vs_opp_all": np.mean(scores),
        "avg_points_allowed_vs_opp_last5": np.mean(last5_opp) if last5_opp else 0.0,
        "avg_points_allowed_vs_opp_last10": np.mean(last10_opp) if last10_opp else 0.0,
        "avg_points_allowed_vs_opp_all": np.mean(opp_scores),
        "score_trend_vs_opp_last5": trend,
        "score_std_vs_opp_last5": std_last5,
        "score_diff_vs_opp_last": diffs[-1] if diffs else 0.0,
        "avg_score_diff_vs_opp_last5": np.mean(diffs[-5:]) if len(diffs) else 0.0,
        "wins_vs_opp_last5": sum(wins[-5:]),
        "wins_vs_opp_last10": sum(wins[-10:]),
        "win_rate_vs_opp_all": sum(wins) / len(wins),
    }


def position_weight(index, total_games, decay=0.99):
    """
    index: position of the game in the list (0 = oldest)
    total_games: total number of games in the list
    decay: controls how fast weight decreases
    """
    # Reverse index so most recent game has index=0
    reverse_index = total_games - 1 - index
    return decay ** reverse_index



def fill_missing_stats(stats_obj, required_keys):
    """
    Ensures all required stats exist in stats_obj.
    Missing stats are added with a default value of 0.
    Returns a new dict.
    """
    complete_stats = {}
    for key in required_keys:
        complete_stats[key] = stats_obj.get(key, 0)
    return complete_stats


logger = logging.getLogger(__name__)


def feature_extraction(games, sport):
    """Extracts features + labels, including:
       - score history
       - opponent-specific history
       - home/away splits
       - score trends, volatility, momentum
       - many additional predictive score features
    """
    BASE_ELO = 1500
    K = 25
    HOME_ADV = 60  # Elo home advantage
    
    feature_list = []
    score_label_list = []
    win_label_list = []

    # ---- Histories ----
    team_history = {}
    team_home_history = {}
    team_away_history = {}
    last_games_info = {}
    team_vs_team_history = {}
    last_seen_season_month = {}

    team_elo = {}               # team_id -> current Elo
    team_elo_history = {}       # team_id -> list of Elo values
    team_sos_components = {}    # team_id -> list of opponent Elos for SOS

    # ---- MAIN LOOP ----
    for game in games:
        if (game.homeStats is None or game.awayStats is None or
            game.homeScore is None or game.awayScore is None):
            continue

        home_id = game.homeTeamDetails.id
        away_id = game.awayTeamDetails.id
        game_month = game.commence_time.month

        # ---- Season reset ----
        for tid in [home_id, away_id]:
            if (tid not in last_seen_season_month or
                (game_month == sport.startMonth and
                 last_seen_season_month.get(tid) != game_month)):
                team_elo[tid] = BASE_ELO
                team_elo_history[tid] = []
                team_sos_components[tid] = []

            last_seen_season_month[tid] = game_month

        # Defaults
        team_elo.setdefault(home_id, BASE_ELO)
        team_elo.setdefault(away_id, BASE_ELO)
        team_elo_history.setdefault(home_id, [])
        team_elo_history.setdefault(away_id, [])
        team_sos_components.setdefault(home_id, [])
        team_sos_components.setdefault(away_id, [])

        pre_elo_home = team_elo[home_id]
        pre_elo_away = team_elo[away_id]

        # Add opponent Elo for SOS
        team_sos_components[home_id].append(pre_elo_away)
        team_sos_components[away_id].append(pre_elo_home)

        # Compute SOS
        sos_home = np.mean(team_sos_components[home_id][:-1]) if len(team_sos_components[home_id]) > 1 else BASE_ELO
        sos_away = np.mean(team_sos_components[away_id][:-1]) if len(team_sos_components[away_id]) > 1 else BASE_ELO
        sos_home_last5 = np.mean(team_sos_components[home_id][-6:-1]) if len(team_sos_components[home_id]) > 5 else sos_home
        sos_away_last5 = np.mean(team_sos_components[away_id][-6:-1]) if len(team_sos_components[away_id]) > 5 else sos_away

        # SRS
        srs_home = pre_elo_home - sos_home
        srs_away = pre_elo_away - sos_away
        elo_hist_home = team_elo_history.get(home_id, [])
        elo_hist_away = team_elo_history.get(away_id, [])
        srs_home_last5 = np.mean([e - s for e, s in zip(elo_hist_home[-5:], team_sos_components[home_id][-6:-1])]) if len(elo_hist_home) >= 1 else srs_home
        srs_away_last5 = np.mean([e - s for e, s in zip(elo_hist_away[-5:], team_sos_components[away_id][-6:-1])]) if len(elo_hist_away) >= 1 else srs_away

        # ---- Stats ----
        homeStats = game.homeStats.data
        awayStats = game.awayStats.data
        if stat_config_map:
            config = stat_config_map.get(getattr(sport, "name", None))
            required_keys = config.get("default", [])
            homeStats = {k: homeStats.get(k, 0) for k in required_keys}
            awayStats = {k: awayStats.get(k, 0) for k in required_keys}
        else:
            required_keys = list(homeStats.keys())

        sport_features_home = {}
        sport_features_away = {}

        if sport.name == 'americanfootball_ncaaf':
            sport_features_home = {
                # ---------------- TEMPO ----------------
                "seconds_per_play": (
                    homeStats.get("possessionTimeSeconds", 0) / max(1, homeStats.get("totalOffensivePlays", 1))
                ),
                "plays_per_minute": (
                    homeStats.get("totalOffensivePlays", 0) /
                    max(1, homeStats.get("possessionTimeSeconds", 1) / 60)
                ),
                "rush_pass_ratio": (
                    homeStats.get("rushingAttempts", 0) /
                    max(1, homeStats.get("passingAttempts", 1))
                ),
                # ---------------- DRIVE EFFICIENCY ----------------
                "points_per_drive": (
                    homeStats.get("totalPoints", 0) / max(1, homeStats.get("totalDrives", 1))
                ),
                "yards_per_drive": (
                    homeStats.get("totalYards", 0) / max(1, homeStats.get("totalDrives", 1))
                ),
                "touchdowns_per_drive": (
                    homeStats.get("totalTouchdowns", 0) / max(1, homeStats.get("totalDrives", 1))
                ),
                # ---------------- SPECIAL TEAMS VALUE ----------------
                "kick_return_explosive_rate": (
                    homeStats.get("kickReturnYards", 0) /
                    max(1, homeStats.get("kickReturns", 1))
                ),
                "punting_efficiency": (
                    homeStats.get("grossAvgPuntYards", 0) *
                    (homeStats.get("puntsInside20Pct", 0))
                ),
                # ---------------- PASS PROTECTION / OL ----------------
                "pressure_allowed_rate": (
                    homeStats.get("hurries", 0) /
                    max(1, homeStats.get("totalOffensivePlays", 1))
                ),
                "sack_rate_allowed": (
                    homeStats.get("sacks", 0) /
                    max(1, homeStats.get("passingAttempts", 1))
                ),
                "run_stuff_rate": (
                    homeStats.get("rushingAttempts", 0) / 
                    max(1, homeStats.get("rushingYards", 1)) 
                    if homeStats.get("rushingYards", 0) < 1 else 0
                ), # safe fallback approx
                # ---------------- TURNOVER DERIVED ----------------
                "turnovers_per_drive": (
                    (homeStats.get("interceptions", 0) + homeStats.get("fumbles", 0)) /
                    max(1, homeStats.get("totalDrives", 1))
                ),
                "interception_rate": (
                    homeStats.get("interceptions", 0) /
                    max(1, homeStats.get("passingAttempts", 1))
                ),
                "fumble_rate": (
                    homeStats.get("fumbles", 0) /
                    max(1, homeStats.get("totalOffensivePlays", 1))
                ),
                # ---------------- PENALTY IMPACT ----------------
                "off_penalty_kill_rate": (
                    homeStats.get("totalPenaltyYards", 0) /
                    max(1, homeStats.get("totalYards", 1))
                ),
                "penalties_per_play": (
                    homeStats.get("totalPenalties", 0) /
                    max(1, homeStats.get("totalOffensivePlays", 1))
                ),
                # --------------- OPPONENT-ADJUSTMENT METRICS (NON-DUPLICATE DIFFS) ---------------
                "opp_def_ypp_diff": (
                    awayStats.get("yardsPerGame", 0) -
                    awayStats.get("yardsAllowed", 0)   # mixing stats → allowed
                ),
                # ---------------- FIELD POSITION PROXY ----------------
                "special_teams_hidden_yards": (
                    homeStats.get("kickReturnYards", 0)
                    + homeStats.get("puntYards", 0)
                    - awayStats.get("kickReturnYards", 0)
                    - awayStats.get("puntYards", 0)
                ),
            }
            sport_features_away = {
                # ---------------- TEMPO ----------------
                "seconds_per_play": (
                    awayStats.get("possessionTimeSeconds", 0) / max(1, awayStats.get("totalOffensivePlays", 1))
                ),
                "plays_per_minute": (
                    awayStats.get("totalOffensivePlays", 0) /
                    max(1, awayStats.get("possessionTimeSeconds", 1) / 60)
                ),
                "rush_pass_ratio": (
                    awayStats.get("rushingAttempts", 0) /
                    max(1, awayStats.get("passingAttempts", 1))
                ),

                # ---------------- DRIVE EFFICIENCY ----------------
                "points_per_drive": (
                    awayStats.get("totalPoints", 0) / max(1, awayStats.get("totalDrives", 1))
                ),
                "yards_per_drive": (
                    awayStats.get("totalYards", 0) / max(1, awayStats.get("totalDrives", 1))
                ),
                "touchdowns_per_drive": (
                    awayStats.get("totalTouchdowns", 0) / max(1, awayStats.get("totalDrives", 1))
                ),

                # ---------------- SPECIAL TEAMS VALUE ----------------
                "kick_return_explosive_rate": (
                    awayStats.get("kickReturnYards", 0) /
                    max(1, awayStats.get("kickReturns", 1))
                ),
                "punting_efficiency": (
                    awayStats.get("grossAvgPuntYards", 0) *
                    (awayStats.get("puntsInside20Pct", 0))
                ),

                # ---------------- PASS PROTECTION / OL ----------------
                "pressure_allowed_rate": (
                    awayStats.get("hurries", 0) /
                    max(1, awayStats.get("totalOffensivePlays", 1))
                ),
                "sack_rate_allowed": (
                    awayStats.get("sacks", 0) /
                    max(1, awayStats.get("passingAttempts", 1))
                ),
                "run_stuff_rate": (
                    awayStats.get("rushingAttempts", 0) / 
                    max(1, awayStats.get("rushingYards", 1))
                    if awayStats.get("rushingYards", 0) < 1 else 0
                ),

                # ---------------- TURNOVER DERIVED ----------------
                "turnovers_per_drive": (
                    (awayStats.get("interceptions", 0) + awayStats.get("fumbles", 0)) /
                    max(1, awayStats.get("totalDrives", 1))
                ),
                "interception_rate": (
                    awayStats.get("interceptions", 0) /
                    max(1, awayStats.get("passingAttempts", 1))
                ),
                "fumble_rate": (
                    awayStats.get("fumbles", 0) /
                    max(1, awayStats.get("totalOffensivePlays", 1))
                ),

                # ---------------- PENALTY IMPACT ----------------
                "off_penalty_kill_rate": (
                    awayStats.get("totalPenaltyYards", 0) /
                    max(1, awayStats.get("totalYards", 1))
                ),
                "penalties_per_play": (
                    awayStats.get("totalPenalties", 0) /
                    max(1, awayStats.get("totalOffensivePlays", 1))
                ),

                # --------------- OPPONENT-ADJUSTMENT METRICS ---------------
                "opp_def_ypp_diff": (
                    homeStats.get("yardsPerGame", 0) -
                    homeStats.get("yardsAllowed", 0)
                ),

                # ---------------- FIELD POSITION PROXY ----------------
                "special_teams_hidden_yards": (
                    awayStats.get("kickReturnYards", 0)
                    + awayStats.get("puntYards", 0)
                    - homeStats.get("kickReturnYards", 0)
                    - homeStats.get("puntYards", 0)
                ),
            }
        elif sport.name == 'americanfootball_nfl':
            sport_features_home = {

            # ---------------- TEMPO ----------------
            "seconds_per_play": (
                homeStats.get("possessionTimeSeconds", 0) /
                max(1, homeStats.get("totalOffensivePlays", 1))
            ),
            "plays_per_minute": (
                homeStats.get("totalOffensivePlays", 0) /
                max(1, homeStats.get("possessionTimeSeconds", 1) / 60)
            ),
            "rush_pass_ratio": (
                homeStats.get("rushingAttempts", 0) /
                max(1, homeStats.get("passingAttempts", 1))
            ),

            # ---------------- DRIVE EFFICIENCY ----------------
            "points_per_drive": (
                homeStats.get("totalPoints", 0) /
                max(1, homeStats.get("totalDrives", 1))
            ),
            "yards_per_drive": (
                homeStats.get("totalYards", 0) /
                max(1, homeStats.get("totalDrives", 1))
            ),
            "touchdowns_per_drive": (
                homeStats.get("totalTouchdowns", 0) /
                max(1, homeStats.get("totalDrives", 1))
            ),
            "third_down_success_rate": (
                homeStats.get("thirdDownConvs", 0) /
                max(1, homeStats.get("thirdDownAttempts", 1))
            ),

            # ---------------- PASS PROTECTION ----------------
            "pressure_rate_allowed": (
                homeStats.get("stuffs", 0) + homeStats.get("tacklesForLoss", 0)
            ) / max(1, homeStats.get("totalOffensivePlays", 1)),
            "sack_rate_allowed": (
                homeStats.get("sacks", 0) /
                max(1, homeStats.get("passingAttempts", 1))
            ),

            # ---------------- TURNOVER DERIVED ----------------
            "turnovers_per_drive": (
                (homeStats.get("interceptions", 0) + homeStats.get("kickoffReturns", 0)) /
                max(1, homeStats.get("totalDrives", 1))
            ),
            "interception_rate": (
                homeStats.get("interceptions", 0) /
                max(1, homeStats.get("passingAttempts", 1))
            ),

            # ---------------- PENALTY IMPACT ----------------
            "penalties_per_play": (
                homeStats.get("totalPenalties", 0) /
                max(1, homeStats.get("totalOffensivePlays", 1))
            ),
            "penalty_yards_per_play": (
                homeStats.get("totalPenaltyYards", 0) /
                max(1, homeStats.get("totalOffensivePlays", 1))
            ),
            "penalty_kill_rate": (
                homeStats.get("totalPenaltyYards", 0) /
                max(1, homeStats.get("totalYards", 1))
            ),

            # ---------------- SPECIAL TEAMS VALUE ----------------
            "punt_efficiency": (
                homeStats.get("grossAvgPuntYards", 0) *
                homeStats.get("puntsInside20Pct", 0)
            ),
            "kick_return_explosive_rate": (
                homeStats.get("kickReturnYards", 0) /
                max(1, homeStats.get("kickReturns", 1))
            ),
            "avg_hidden_yards_special_teams": (
                homeStats.get("kickoffYards", 0)
                + homeStats.get("puntYards", 0)
                - awayStats.get("kickoffYards", 0)
                - awayStats.get("puntYards", 0)
            ),

            # ---------------- OPPONENT DEFENSE ADJUSTMENTS (cross-stat diffs OK) ----------------
            "opp_def_yards_allowed_per_play": (
                awayStats.get("yardsAllowed", 0) /
                max(1, awayStats.get("totalDefensivePlays", awayStats.get("totalOffensivePlays", 1)))
            ),
            "opp_pass_rush_pressure_proxy": (
                awayStats.get("sacks", 0) + awayStats.get("tacklesForLoss", 0)
            ),
        }
            sport_features_away = {

                # ---------------- TEMPO ----------------
                "seconds_per_play": (
                    awayStats.get("possessionTimeSeconds", 0) /
                    max(1, awayStats.get("totalOffensivePlays", 1))
                ),
                "plays_per_minute": (
                    awayStats.get("totalOffensivePlays", 0) /
                    max(1, awayStats.get("possessionTimeSeconds", 1) / 60)
                ),
                "rush_pass_ratio": (
                    awayStats.get("rushingAttempts", 0) /
                    max(1, awayStats.get("passingAttempts", 1))
                ),

                # ---------------- DRIVE EFFICIENCY ----------------
                "points_per_drive": (
                    awayStats.get("totalPoints", 0) /
                    max(1, awayStats.get("totalDrives", 1))
                ),
                "yards_per_drive": (
                    awayStats.get("totalYards", 0) /
                    max(1, awayStats.get("totalDrives", 1))
                ),
                "touchdowns_per_drive": (
                    awayStats.get("totalTouchdowns", 0) /
                    max(1, awayStats.get("totalDrives", 1))
                ),
                "third_down_success_rate": (
                    awayStats.get("thirdDownConvs", 0) /
                    max(1, awayStats.get("thirdDownAttempts", 1))
                ),

                # ---------------- PASS PROTECTION ----------------
                "pressure_rate_allowed": (
                    awayStats.get("stuffs", 0) + awayStats.get("tacklesForLoss", 0)
                ) / max(1, awayStats.get("totalOffensivePlays", 1)),
                "sack_rate_allowed": (
                    awayStats.get("sacks", 0) /
                    max(1, awayStats.get("passingAttempts", 1))
                ),

                # ---------------- TURNOVER DERIVED ----------------
                "turnovers_per_drive": (
                    (awayStats.get("interceptions", 0) + awayStats.get("kickoffReturns", 0)) /
                    max(1, awayStats.get("totalDrives", 1))
                ),
                "interception_rate": (
                    awayStats.get("interceptions", 0) /
                    max(1, awayStats.get("passingAttempts", 1))
                ),

                # ---------------- PENALTY IMPACT ----------------
                "penalties_per_play": (
                    awayStats.get("totalPenalties", 0) /
                    max(1, awayStats.get("totalOffensivePlays", 1))
                ),
                "penalty_yards_per_play": (
                    awayStats.get("totalPenaltyYards", 0) /
                    max(1, awayStats.get("totalOffensivePlays", 1))
                ),
                "penalty_kill_rate": (
                    awayStats.get("totalPenaltyYards", 0) /
                    max(1, awayStats.get("totalYards", 1))
                ),

                # ---------------- SPECIAL TEAMS VALUE ----------------
                "punt_efficiency": (
                    awayStats.get("grossAvgPuntYards", 0) *
                    awayStats.get("puntsInside20Pct", 0)
                ),
                "kick_return_explosive_rate": (
                    awayStats.get("kickReturnYards", 0) /
                    max(1, awayStats.get("kickReturns", 1))
                ),
                "avg_hidden_yards_special_teams": (
                    awayStats.get("kickoffYards", 0)
                    + awayStats.get("puntYards", 0)
                    - homeStats.get("kickoffYards", 0)
                    - homeStats.get("puntYards", 0)
                ),

                # ---------------- OPPONENT DEFENSE ADJUSTMENTS ----------------
                "opp_def_yards_allowed_per_play": (
                    homeStats.get("yardsAllowed", 0) /
                    max(1, homeStats.get("totalDefensivePlays", homeStats.get("totalOffensivePlays", 1)))
                ),
                "opp_pass_rush_pressure_proxy": (
                    homeStats.get("sacks", 0) + homeStats.get("tacklesForLoss", 0)
                ),
            }
        elif sport.name == 'basketball_nba':
            sport_features_home = {

                # ---------------- PACE / TEMPO ----------------
                "pace_factor": (
                    homeStats.get("estimatedPossessions", 0) / max(1, homeStats.get("gamesPlayed", 1))
                ),
                "opp_pace_factor": (
                    awayStats.get("estimatedPossessions", 0) / max(1, awayStats.get("gamesPlayed", 1))
                ),
                "pace_ratio": (
                    homeStats.get("estimatedPossessions", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- SHOT PROFILE COMPOSITION ----------------
                "three_point_rate": (
                    homeStats.get("threePointFieldGoalsAttempted", 0) /
                    max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),
                "two_point_rate": (
                    homeStats.get("twoPointFieldGoalsAttempted", 0) /
                    max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),
                "free_throw_rate": (
                    homeStats.get("freeThrowsAttempted", 0) /
                    max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),
                "paint_scoring_rate": (
                    homeStats.get("pointsInPaint", 0) /
                    max(1, homeStats.get("points", 1))
                ),
                "fast_break_rate": (
                    homeStats.get("fastBreakPoints", 0) /
                    max(1, homeStats.get("points", 1))
                ),

                # ---------------- SHOT QUALITY PROXIES ----------------
                "effective_shot_mix_value": (
                    (
                        3 * homeStats.get("threePointFieldGoalsMade", 0)
                        + 2 * homeStats.get("twoPointFieldGoalsMade", 0)
                        + homeStats.get("freeThrowsMade", 0)
                    ) / max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),
                "shot_creation_efficiency": (
                    homeStats.get("assists", 0) /
                    max(1, homeStats.get("fieldGoalsMade", 1))
                ),

                # ---------------- REBOUND IMPACT ----------------
                "rebound_pressure_ratio": (
                    homeStats.get("offensiveRebounds", 0) /
                    max(1, awayStats.get("defensiveRebounds", 1))
                ),
                "second_chance_rate": (
                    homeStats.get("offensiveRebounds", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- TURNOVER IMPACT / BALL SECURITY ----------------
                "turnover_rate": (
                    homeStats.get("turnovers", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "opp_turnover_pressure": (
                    awayStats.get("steals", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "live_ball_turnover_ratio": (
                    homeStats.get("steals", 0) /
                    max(1, homeStats.get("turnovers", 1))
                ),

                # ---------------- FOUL / FREE THROW PRESSURE ----------------
                "foul_pressure_rate": (
                    homeStats.get("fouls", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "opp_foul_draw_rate": (
                    awayStats.get("fouls", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- DEFENSIVE DISRUPTION ON OPPONENT ----------------
                "opp_block_pressure": (
                    awayStats.get("blocks", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "opp_steal_disruption": (
                    awayStats.get("steals", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- POSSESSION VALUE ADD ----------------
                "points_per_possession_est": (
                    homeStats.get("points", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "assist_ratio": (
                    homeStats.get("assists", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "free_throw_points_ratio": (
                    homeStats.get("freeThrowsMade", 0) * 1.0 /
                    max(1, homeStats.get("points", 1))
                ),

                # ---------------- OPPONENT DEFENSE ADJUSTMENTS ----------------
                "opp_rebound_strength": (
                    awayStats.get("totalRebounds", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
                "opp_def_disruption_rate": (
                    (awayStats.get("steals", 0) + awayStats.get("blocks", 0)) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "opp_shot_defense_efficiency": (
                    awayStats.get("fieldGoalsAttempted", 0) -
                    awayStats.get("fieldGoalsMade", 0)
                ) / max(1, awayStats.get("fieldGoalsAttempted", 1)),
            }
            sport_features_away = {

                # ---------------- PACE / TEMPO ----------------
                "pace_factor": (
                    awayStats.get("estimatedPossessions", 0) / max(1, awayStats.get("gamesPlayed", 1))
                ),
                "opp_pace_factor": (
                    homeStats.get("estimatedPossessions", 0) / max(1, homeStats.get("gamesPlayed", 1))
                ),
                "pace_ratio": (
                    awayStats.get("estimatedPossessions", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- SHOT PROFILE COMPOSITION ----------------
                "three_point_rate": (
                    awayStats.get("threePointFieldGoalsAttempted", 0) /
                    max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),
                "two_point_rate": (
                    awayStats.get("twoPointFieldGoalsAttempted", 0) /
                    max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),
                "free_throw_rate": (
                    awayStats.get("freeThrowsAttempted", 0) /
                    max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),
                "paint_scoring_rate": (
                    awayStats.get("pointsInPaint", 0) /
                    max(1, awayStats.get("points", 1))
                ),
                "fast_break_rate": (
                    awayStats.get("fastBreakPoints", 0) /
                    max(1, awayStats.get("points", 1))
                ),

                # ---------------- SHOT QUALITY PROXIES ----------------
                "effective_shot_mix_value": (
                    (
                        3 * awayStats.get("threePointFieldGoalsMade", 0)
                        + 2 * awayStats.get("twoPointFieldGoalsMade", 0)
                        + awayStats.get("freeThrowsMade", 0)
                    ) / max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),
                "shot_creation_efficiency": (
                    awayStats.get("assists", 0) /
                    max(1, awayStats.get("fieldGoalsMade", 1))
                ),

                # ---------------- REBOUND IMPACT ----------------
                "rebound_pressure_ratio": (
                    awayStats.get("offensiveRebounds", 0) /
                    max(1, homeStats.get("defensiveRebounds", 1))
                ),
                "second_chance_rate": (
                    awayStats.get("offensiveRebounds", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- TURNOVER IMPACT ----------------
                "turnover_rate": (
                    awayStats.get("turnovers", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "opp_turnover_pressure": (
                    homeStats.get("steals", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "live_ball_turnover_ratio": (
                    awayStats.get("steals", 0) /
                    max(1, awayStats.get("turnovers", 1))
                ),

                # ---------------- FOUL / FREE THROW PRESSURE ----------------
                "foul_pressure_rate": (
                    awayStats.get("fouls", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "opp_foul_draw_rate": (
                    homeStats.get("fouls", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- DEFENSIVE DISRUPTION ----------------
                "opp_block_pressure": (
                    homeStats.get("blocks", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "opp_steal_disruption": (
                    homeStats.get("steals", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- POSSESSION VALUE ADD ----------------
                "points_per_possession_est": (
                    awayStats.get("points", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "assist_ratio": (
                    awayStats.get("assists", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "free_throw_points_ratio": (
                    awayStats.get("freeThrowsMade", 0) * 1.0 /
                    max(1, awayStats.get("points", 1))
                ),

                # ---------------- OPPONENT DEFENSE ADJUSTMENTS ----------------
                "opp_rebound_strength": (
                    homeStats.get("totalRebounds", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
                "opp_def_disruption_rate": (
                    (homeStats.get("steals", 0) + homeStats.get("blocks", 0)) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "opp_shot_defense_efficiency": (
                    homeStats.get("fieldGoalsAttempted", 0) -
                    homeStats.get("fieldGoalsMade", 0)
                ) / max(1, homeStats.get("fieldGoalsAttempted", 1)),

            }
        elif sport.name == 'basketball_ncaab':
            sport_features_home = {

                # ---------------- PACE / TEMPO ----------------
                "pace_factor": (
                    homeStats.get("estimatedPossessions", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
                "opp_pace_factor": (
                    awayStats.get("estimatedPossessions", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
                "pace_ratio": (
                    homeStats.get("estimatedPossessions", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- SHOT PROFILE COMPOSITION ----------------
                "three_point_rate": (
                    homeStats.get("threePointFieldGoalsAttempted", 0) /
                    max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),
                "two_point_rate": (
                    homeStats.get("twoPointFieldGoalsAttempted", 0) /
                    max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),
                "free_throw_rate": (
                    homeStats.get("freeThrowsAttempted", 0) /
                    max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),

                # ---------------- SHOT QUALITY PROXIES ----------------
                "shot_creation_efficiency": (
                    homeStats.get("assists", 0) /
                    max(1, homeStats.get("fieldGoalsMade", 1))
                ),
                "effective_shot_mix_value": (
                    (
                        3 * homeStats.get("threePointFieldGoalsMade", 0)
                        + 2 * homeStats.get("twoPointFieldGoalsMade", 0)
                        + homeStats.get("freeThrowsMade", 0)
                    ) / max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),

                # ---------------- REBOUND LEVERAGE ----------------
                "rebound_pressure_ratio": (
                    homeStats.get("offensiveRebounds", 0) /
                    max(1, awayStats.get("defensiveRebounds", 1))
                ),
                "second_chance_rate": (
                    homeStats.get("offensiveRebounds", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- PAINT AND TRANSITION SCORING ----------------
                "fast_break_rate": (
                    homeStats.get("fastBreakPoints", 0) /
                    max(1, homeStats.get("points", 1))
                ),

                # ---------------- TURNOVER PRESSURE ----------------
                "turnover_rate": (
                    homeStats.get("turnovers", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "live_ball_turnover_ratio": (
                    homeStats.get("steals", 0) /
                    max(1, homeStats.get("turnovers", 1))
                ),
                "opp_turnover_pressure": (
                    awayStats.get("steals", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- FOUL PRESSURE / FT DAMAGE ----------------
                "foul_pressure_rate": (
                    homeStats.get("fouls", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "free_throw_points_ratio": (
                    homeStats.get("freeThrowsMade", 0) /
                    max(1, homeStats.get("points", 1))
                ),

                # ---------------- DEFENSIVE DISRUPTION ----------------
                "def_disruption_rate": (
                    (homeStats.get("blocks", 0) + homeStats.get("steals", 0)) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "opp_shot_disruption": (
                    (awayStats.get("blocks", 0) + awayStats.get("steals", 0)) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- SCORE EFFICIENCY / POSSESSION VALUE ----------------
                "points_per_possession_est": (
                    homeStats.get("points", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "assist_ratio": (
                    homeStats.get("assists", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- OPPONENT REBOUND DEFENSE ----------------
                "opp_rebound_strength": (
                    awayStats.get("totalRebounds", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),

                # ---------------- OPPONENT SHOOTING RESISTANCE ----------------
                "opp_effective_fg_resistance": (
                    (
                        awayStats.get("fieldGoalsAttempted", 0)
                        - awayStats.get("fieldGoalsMade", 0)
                    ) / max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),
            }
            sport_features_away = {

                # ---------------- PACE / TEMPO ----------------
                "pace_factor": (
                    awayStats.get("estimatedPossessions", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
                "opp_pace_factor": (
                    homeStats.get("estimatedPossessions", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
                "pace_ratio": (
                    awayStats.get("estimatedPossessions", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- SHOT PROFILE COMPOSITION ----------------
                "three_point_rate": (
                    awayStats.get("threePointFieldGoalsAttempted", 0) /
                    max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),
                "two_point_rate": (
                    awayStats.get("twoPointFieldGoalsAttempted", 0) /
                    max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),
                "free_throw_rate": (
                    awayStats.get("freeThrowsAttempted", 0) /
                    max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),

                # ---------------- SHOT QUALITY PROXIES ----------------
                "shot_creation_efficiency": (
                    awayStats.get("assists", 0) /
                    max(1, awayStats.get("fieldGoalsMade", 1))
                ),
                "effective_shot_mix_value": (
                    (
                        3 * awayStats.get("threePointFieldGoalsMade", 0)
                        + 2 * awayStats.get("twoPointFieldGoalsMade", 0)
                        + awayStats.get("freeThrowsMade", 0)
                    ) / max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),

                # ---------------- REBOUND LEVERAGE ----------------
                "rebound_pressure_ratio": (
                    awayStats.get("offensiveRebounds", 0) /
                    max(1, homeStats.get("defensiveRebounds", 1))
                ),
                "second_chance_rate": (
                    awayStats.get("offensiveRebounds", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- PAINT / TRANSITION ----------------
                "fast_break_rate": (
                    awayStats.get("fastBreakPoints", 0) /
                    max(1, awayStats.get("points", 1))
                ),

                # ---------------- TURNOVER PRESSURE ----------------
                "turnover_rate": (
                    awayStats.get("turnovers", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "live_ball_turnover_ratio": (
                    awayStats.get("steals", 0) /
                    max(1, awayStats.get("turnovers", 1))
                ),
                "opp_turnover_pressure": (
                    homeStats.get("steals", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- FOUL / FT PRESSURE ----------------
                "foul_pressure_rate": (
                    awayStats.get("fouls", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "free_throw_points_ratio": (
                    awayStats.get("freeThrowsMade", 0) /
                    max(1, awayStats.get("points", 1))
                ),

                # ---------------- DEFENSIVE DISRUPTION ----------------
                "def_disruption_rate": (
                    (awayStats.get("blocks", 0) + awayStats.get("steals", 0)) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "opp_shot_disruption": (
                    (homeStats.get("blocks", 0) + homeStats.get("steals", 0)) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- SCORING EFFICIENCY ----------------
                "points_per_possession_est": (
                    awayStats.get("points", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "assist_ratio": (
                    awayStats.get("assists", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- OPPONENT REBOUND DEFENSE ----------------
                "opp_rebound_strength": (
                    homeStats.get("totalRebounds", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),

                # ---------------- OPPONENT SHOOTING RESISTANCE ----------------
                "opp_effective_fg_resistance": (
                    (
                        homeStats.get("fieldGoalsAttempted", 0)
                        - homeStats.get("fieldGoalsMade", 0)
                    ) /
                    max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),
            }
        elif sport.name == 'basketball_wncaab':
            sport_features_home = {

                # ---------------- PACE / TEMPO ----------------
                "pace_factor": (
                    homeStats.get("estimatedPossessions", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
                "opp_pace_factor": (
                    awayStats.get("estimatedPossessions", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
                "pace_ratio": (
                    homeStats.get("estimatedPossessions", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- SHOT PROFILE ----------------
                "three_point_rate": (
                    homeStats.get("threePointFieldGoalsAttempted", 0) /
                    max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),
                "two_point_rate": (
                    homeStats.get("twoPointFieldGoalsAttempted", 0) /
                    max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),
                "free_throw_rate": (
                    homeStats.get("freeThrowsAttempted", 0) /
                    max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),

                # ---------------- SHOT QUALITY ----------------
                "shot_creation_efficiency": (
                    homeStats.get("assists", 0) /
                    max(1, homeStats.get("fieldGoalsMade", 1))
                ),
                "effective_shot_mix_value": (
                    (
                        3 * homeStats.get("threePointFieldGoalsMade", 0)
                        + 2 * homeStats.get("twoPointFieldGoalsMade", 0)
                        + homeStats.get("freeThrowsMade", 0)
                    ) / max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),

                # ---------------- REBOUND IMPACT ----------------
                "rebound_pressure_ratio": (
                    homeStats.get("offensiveRebounds", 0) /
                    max(1, awayStats.get("defensiveRebounds", 1))
                ),
                "second_chance_rate": (
                    homeStats.get("offensiveRebounds", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- TURNOVER PROFILE ----------------
                "turnover_rate": (
                    homeStats.get("turnovers", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "live_ball_turnover_ratio": (
                    homeStats.get("steals", 0) /
                    max(1, homeStats.get("turnovers", 1))
                ),
                "opp_turnover_pressure": (
                    awayStats.get("steals", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- FOUL & FREE THROW IMPACT ----------------
                "free_throw_points_ratio": (
                    homeStats.get("freeThrowsMade", 0) /
                    max(1, homeStats.get("points", 1))
                ),
                "foul_pressure_rate": (
                    homeStats.get("fouls", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- DEFENSIVE DISRUPTION ----------------
                "def_disruption_rate": (
                    (homeStats.get("blocks", 0) + homeStats.get("steals", 0)) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "opp_shot_disruption": (
                    (awayStats.get("blocks", 0) + awayStats.get("steals", 0)) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- TRANSITION SCORING ----------------
                "fast_break_rate": (
                    homeStats.get("fastBreakPoints", 0) /
                    max(1, homeStats.get("points", 1))
                ),

                # ---------------- POSSESSION EFFICIENCY ----------------
                "points_per_possession_est": (
                    homeStats.get("points", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),
                "assist_ratio": (
                    homeStats.get("assists", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- OPPONENT REBOUND DEFENSE ----------------
                "opp_rebound_strength": (
                    awayStats.get("totalRebounds", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),

                # ---------------- OPPONENT SHOOTING RESISTANCE ----------------
                "opp_effective_fg_resistance": (
                    (
                        awayStats.get("fieldGoalsAttempted", 0)
                        - awayStats.get("fieldGoalsMade", 0)
                    ) / max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),
            }
            sport_features_away = {

                # ---------------- PACE / TEMPO ----------------
                "pace_factor": (
                    awayStats.get("estimatedPossessions", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
                "opp_pace_factor": (
                    homeStats.get("estimatedPossessions", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
                "pace_ratio": (
                    awayStats.get("estimatedPossessions", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- SHOT PROFILE ----------------
                "three_point_rate": (
                    awayStats.get("threePointFieldGoalsAttempted", 0) /
                    max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),
                "two_point_rate": (
                    awayStats.get("twoPointFieldGoalsAttempted", 0) /
                    max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),
                "free_throw_rate": (
                    awayStats.get("freeThrowsAttempted", 0) /
                    max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),

                # ---------------- SHOT QUALITY ----------------
                "shot_creation_efficiency": (
                    awayStats.get("assists", 0) /
                    max(1, awayStats.get("fieldGoalsMade", 1))
                ),
                "effective_shot_mix_value": (
                    (
                        3 * awayStats.get("threePointFieldGoalsMade", 0)
                        + 2 * awayStats.get("twoPointFieldGoalsMade", 0)
                        + awayStats.get("freeThrowsMade", 0)
                    ) / max(1, awayStats.get("fieldGoalsAttempted", 1))
                ),

                # ---------------- REBOUND IMPACT ----------------
                "rebound_pressure_ratio": (
                    awayStats.get("offensiveRebounds", 0) /
                    max(1, homeStats.get("defensiveRebounds", 1))
                ),
                "second_chance_rate": (
                    awayStats.get("offensiveRebounds", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- TURNOVER PROFILE ----------------
                "turnover_rate": (
                    awayStats.get("turnovers", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "live_ball_turnover_ratio": (
                    awayStats.get("steals", 0) /
                    max(1, awayStats.get("turnovers", 1))
                ),
                "opp_turnover_pressure": (
                    homeStats.get("steals", 0) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- FOUL & FREE THROW IMPACT ----------------
                "free_throw_points_ratio": (
                    awayStats.get("freeThrowsMade", 0) /
                    max(1, awayStats.get("points", 1))
                ),
                "foul_pressure_rate": (
                    awayStats.get("fouls", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- DEFENSIVE DISRUPTION ----------------
                "def_disruption_rate": (
                    (awayStats.get("blocks", 0) + awayStats.get("steals", 0)) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "opp_shot_disruption": (
                    (homeStats.get("blocks", 0) + homeStats.get("steals", 0)) /
                    max(1, homeStats.get("estimatedPossessions", 1))
                ),

                # ---------------- TRANSITION SCORING ----------------
                "fast_break_rate": (
                    awayStats.get("fastBreakPoints", 0) /
                    max(1, awayStats.get("points", 1))
                ),

                # ---------------- POSSESSION EFFICIENCY ----------------
                "points_per_possession_est": (
                    awayStats.get("points", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),
                "assist_ratio": (
                    awayStats.get("assists", 0) /
                    max(1, awayStats.get("estimatedPossessions", 1))
                ),

                # ---------------- OPPONENT REBOUND DEFENSE ----------------
                "opp_rebound_strength": (
                    homeStats.get("totalRebounds", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),

                # ---------------- OPPONENT SHOOTING RESISTANCE ----------------
                "opp_effective_fg_resistance": (
                    (
                        homeStats.get("fieldGoalsAttempted", 0)
                        - homeStats.get("fieldGoalsMade", 0)
                    ) / max(1, homeStats.get("fieldGoalsAttempted", 1))
                ),
            }
        elif sport.name == 'icehockey_nhl':
            sport_features_home = {

                # ---------------- SHOOTING & XG-LIKE PROXIES ----------------
                "shots_per_game": (
                    homeStats.get("shotsTotal", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
                "shot_accuracy": (
                    homeStats.get("goals", 0) /
                    max(1, homeStats.get("shotsTotal", 1))
                ),
                "dangerous_shot_ratio": (
                    (homeStats.get("shotsIn1stPeriod", 0) + homeStats.get("shotsIn3rdPeriod", 0)) /
                    max(1, homeStats.get("shotsTotal", 1))
                ),  # 1st & 3rd period shots correlate w/ higher danger & offensive momentum

                # ---------------- REBOUND / SECOND-CHANCE OFFENSE ----------------
                "rebound_opportunities": (
                    homeStats.get("shotsMissed", 0) /
                    max(1, homeStats.get("shotsTotal", 1))
                ),

                # ---------------- GOALTENDING PRESSURE ----------------
                "goalie_shot_load": (
                    homeStats.get("shotsAgainst", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
                "goalie_efficiency_gap": (
                    homeStats.get("savePct", 0) -
                    awayStats.get("savePct", 0)
                ),

                # ---------------- DEFENSIVE DISRUPTION ----------------
                "defense_disruption_rate": (
                    (homeStats.get("blockedShots", 0) + homeStats.get("hits", 0)) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
                "takeaway_pressure_rate": (
                    homeStats.get("takeaways", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),

                # ---------------- TRANSITION / TURNOVERS ----------------
                "transition_efficiency": (
                    homeStats.get("takeaways", 0) /
                    max(1, homeStats.get("giveaways", 1))
                ),
                "opp_transition_threat": (
                    awayStats.get("takeaways", 0) /
                    max(1, awayStats.get("giveaways", 1))
                ),

                # ---------------- SPECIAL TEAMS QUALITY ----------------
                "pp_volume_rate": (
                    homeStats.get("powerPlayOpportunities", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
                "pp_conversion_efficiency": (
                    homeStats.get("powerPlayGoals", 0) /
                    max(1, homeStats.get("powerPlayOpportunities", 1))
                ),
                "pk_vulnerability": (
                    homeStats.get("powerPlayGoalsAgainst", 0) /
                    max(1, homeStats.get("timesShortHanded", 1))
                ),

                # ---------------- FACE-OFF / POSSESSION CONTROL ----------------
                "faceoff_control_rate": (
                    homeStats.get("faceoffsWon", 0) /
                    max(1, homeStats.get("faceoffsWon", 0) + homeStats.get("faceoffsLost", 0))
                ),
                "opp_faceoff_strength": (
                    awayStats.get("faceoffsWon", 0) /
                    max(1, awayStats.get("totalFaceOffs", 1))
                ),

                # ---------------- MOMENTUM / PERIOD WEIGHTING ----------------
                "third_period_scoring_bias": (
                    homeStats.get("shotsIn3rdPeriod", 0) /
                    max(1, homeStats.get("shotsTotal", 1))
                ),

                # ---------------- PENALTIES & DISCIPLINE ----------------
                "penalty_burden_rate": (
                    homeStats.get("penaltyMinutes", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
                "opp_penalty_opportunity": (
                    awayStats.get("penalties", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),

                # ---------------- TOTAL OFFENSIVE PRESSURE ----------------
                "offensive_pressure_index": (
                    (homeStats.get("shotsTotal", 0) + homeStats.get("takeaways", 0)) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
            }
            sport_features_away = {

                # ---------------- SHOOTING & XG-LIKE PROXIES ----------------
                "shots_per_game": (
                    awayStats.get("shotsTotal", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
                "shot_accuracy": (
                    awayStats.get("goals", 0) /
                    max(1, awayStats.get("shotsTotal", 1))
                ),
                "dangerous_shot_ratio": (
                    (awayStats.get("shotsIn1stPeriod", 0) + awayStats.get("shotsIn3rdPeriod", 0)) /
                    max(1, awayStats.get("shotsTotal", 1))
                ),

                # ---------------- REBOUND / SECOND-CHANCE OFFENSE ----------------
                "rebound_opportunities": (
                    awayStats.get("shotsMissed", 0) /
                    max(1, awayStats.get("shotsTotal", 1))
                ),

                # ---------------- GOALTENDING PRESSURE ----------------
                "goalie_shot_load": (
                    awayStats.get("shotsAgainst", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
                "goalie_efficiency_gap": (
                    awayStats.get("savePct", 0) -
                    homeStats.get("savePct", 0)
                ),

                # ---------------- DEFENSIVE DISRUPTION ----------------
                "defense_disruption_rate": (
                    (awayStats.get("blockedShots", 0) + awayStats.get("hits", 0)) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
                "takeaway_pressure_rate": (
                    awayStats.get("takeaways", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),

                # ---------------- TRANSITION / TURNOVERS ----------------
                "transition_efficiency": (
                    awayStats.get("takeaways", 0) /
                    max(1, awayStats.get("giveaways", 1))
                ),
                "opp_transition_threat": (
                    homeStats.get("takeaways", 0) /
                    max(1, homeStats.get("giveaways", 1))
                ),

                # ---------------- SPECIAL TEAMS QUALITY ----------------
                "pp_volume_rate": (
                    awayStats.get("powerPlayOpportunities", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
                "pp_conversion_efficiency": (
                    awayStats.get("powerPlayGoals", 0) /
                    max(1, awayStats.get("powerPlayOpportunities", 1))
                ),
                "pk_vulnerability": (
                    awayStats.get("powerPlayGoalsAgainst", 0) /
                    max(1, awayStats.get("timesShortHanded", 1))
                ),

                # ---------------- FACE-OFF / POSSESSION CONTROL ----------------
                "faceoff_control_rate": (
                    awayStats.get("faceoffsWon", 0) /
                    max(1, awayStats.get("faceoffsWon", 0) + awayStats.get("faceoffsLost", 0))
                ),
                "opp_faceoff_strength": (
                    homeStats.get("faceoffsWon", 0) /
                    max(1, homeStats.get("totalFaceOffs", 1))
                ),

                # ---------------- MOMENTUM / PERIOD WEIGHTING ----------------
                "third_period_scoring_bias": (
                    awayStats.get("shotsIn3rdPeriod", 0) /
                    max(1, awayStats.get("shotsTotal", 1))
                ),

                # ---------------- PENALTIES & DISCIPLINE ----------------
                "penalty_burden_rate": (
                    awayStats.get("penaltyMinutes", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
                "opp_penalty_opportunity": (
                    homeStats.get("penalties", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),

                # ---------------- TOTAL OFFENSIVE PRESSURE ----------------
                "offensive_pressure_index": (
                    (awayStats.get("shotsTotal", 0) + awayStats.get("takeaways", 0)) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
            }
        elif sport.name == 'baseball_mlb':
            sport_features_home = {

                # ----------------- CONTACT QUALITY / EXPECTED RUN PROXIES -----------------
                "line_drive_ratio": (
                    homeStats.get("extraBaseHits", 0) /
                    max(1, homeStats.get("hits", 1))
                ),
                "power_ratio": (
                    homeStats.get("homeRuns", 0) /
                    max(1, homeStats.get("atBats", 1))
                ),
                "contact_quality_index": (
                    (homeStats.get("slugAvg", 0) + homeStats.get("isolatedPower", 0)) / 2
                ),

                # ----------------- RUN PRESSURE / BASEPATH THREATS -----------------
                "baserunning_threat_index": (
                    (homeStats.get("stolenBases", 0) + homeStats.get("hitByPitch", 0)) /
                    max(1, homeStats.get("plateAppearances", 1))
                ),
                "run_pressure_conversion": (
                    homeStats.get("RBIs", 0) /
                    max(1, homeStats.get("runnersLeftOnBase", 1))
                ),

                # ----------------- CLUTCH / SCORING OPPORTUNITY INDICATORS -----------------
                "scoring_efficiency_rate": (
                    homeStats.get("runs", 0) /
                    max(1, homeStats.get("totalBases", 1))
                ),
                "late_inning_resilience": (
                    homeStats.get("finishes", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),

                # ----------------- STARTING PITCHER QUALITY IMPACT -----------------
                "starter_load_index": (
                    homeStats.get("pitchesAsStarter", 0) /
                    max(1, homeStats.get("gamesStarted", 1))
                ),
                "starter_efficiency": (
                    homeStats.get("pitchesPerStart", 0)
                ),

                # ----------------- BULLPEN FATIGUE / VOLATILITY -----------------
                "bullpen_fatigue_index": (
                    homeStats.get("innings", 0) -
                    homeStats.get("thirdInnings", 0) / 3
                ),
                "bullpen_leak_rate": (
                    homeStats.get("earnedRuns", 0) /
                    max(1, homeStats.get("innings", 1))
                ),

                # ----------------- DEFENSIVE SUPPORT FOR RUN PREVENTION -----------------
                "defensive_conversion_rate": (
                    homeStats.get("successfulChances", 0) /
                    max(1, homeStats.get("totalChances", 1))
                ),
                "range_factor_per_game": (
                    homeStats.get("rangeFactor", 0) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),

                # ----------------- PITCHING CONTACT SUPPRESSION -----------------
                "hard_contact_allowed_rate": (
                    homeStats.get("opponentTotalBases", 0) /
                    max(1, homeStats.get("battersFaced", 1))
                ),
                "pitcher_pressure_index": (
                    homeStats.get("pitchesPerInning", 0)
                ),

                # ----------------- WALK / DISCIPLINE ADVANTAGE -----------------
                "discipline_advantage": (
                    homeStats.get("walkToStrikeoutRatio", 0) -
                    awayStats.get("walkToStrikeoutRatio", 0)
                ),

                # ----------------- LEVERAGE & SCORING MOMENTUM -----------------
                "run_creation_momentum": (
                    homeStats.get("runsCreated", 0) /
                    max(1, homeStats.get("plateAppearances", 1))
                ),
                "xrun_proxy": (
                    (homeStats.get("onBasePct", 0) * homeStats.get("slugAvg", 0))
                ),

                # ----------------- OPPONENT PITCHING VULNERABILITY -----------------
                "opp_pitching_damage_rate": (
                    awayStats.get("earnedRuns", 0) /
                    max(1, awayStats.get("innings", 1))
                ),
                "opp_hr_vulnerability": (
                    awayStats.get("homeRuns", 0) /
                    max(1, awayStats.get("battersFaced", 1))
                ),

                # ----------------- TOTAL OFFENSIVE PRESSURE -----------------
                "offensive_pressure_index": (
                    (homeStats.get("plateAppearances", 0) + homeStats.get("totalBases", 0)) /
                    max(1, homeStats.get("gamesPlayed", 1))
                ),
            }
            sport_features_away = {

                # ----------------- CONTACT QUALITY / EXPECTED RUN PROXIES -----------------
                "line_drive_ratio": (
                    awayStats.get("extraBaseHits", 0) /
                    max(1, awayStats.get("hits", 1))
                ),
                "power_ratio": (
                    awayStats.get("homeRuns", 0) /
                    max(1, awayStats.get("atBats", 1))
                ),
                "contact_quality_index": (
                    (awayStats.get("slugAvg", 0) + awayStats.get("isolatedPower", 0)) / 2
                ),

                # ----------------- RUN PRESSURE / BASEPATH THREATS -----------------
                "baserunning_threat_index": (
                    (awayStats.get("stolenBases", 0) + awayStats.get("hitByPitch", 0)) /
                    max(1, awayStats.get("plateAppearances", 1))
                ),
                "run_pressure_conversion": (
                    awayStats.get("RBIs", 0) /
                    max(1, awayStats.get("runnersLeftOnBase", 1))
                ),

                # ----------------- CLUTCH / SCORING OPPORTUNITY INDICATORS -----------------
                "scoring_efficiency_rate": (
                    awayStats.get("runs", 0) /
                    max(1, awayStats.get("totalBases", 1))
                ),
                "late_inning_resilience": (
                    awayStats.get("finishes", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),

                # ----------------- STARTING PITCHER QUALITY IMPACT -----------------
                "starter_load_index": (
                    awayStats.get("pitchesAsStarter", 0) /
                    max(1, awayStats.get("gamesStarted", 1))
                ),
                "starter_efficiency": (
                    awayStats.get("pitchesPerStart", 0)
                ),

                # ----------------- BULLPEN FATIGUE / VOLATILITY -----------------
                "bullpen_fatigue_index": (
                    awayStats.get("innings", 0) -
                    awayStats.get("thirdInnings", 0) / 3
                ),
                "bullpen_leak_rate": (
                    awayStats.get("earnedRuns", 0) /
                    max(1, awayStats.get("innings", 1))
                ),

                # ----------------- DEFENSIVE SUPPORT FOR RUN PREVENTION -----------------
                "defensive_conversion_rate": (
                    awayStats.get("successfulChances", 0) /
                    max(1, awayStats.get("totalChances", 1))
                ),
                "range_factor_per_game": (
                    awayStats.get("rangeFactor", 0) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),

                # ----------------- PITCHING CONTACT SUPPRESSION -----------------
                "hard_contact_allowed_rate": (
                    awayStats.get("opponentTotalBases", 0) /
                    max(1, awayStats.get("battersFaced", 1))
                ),
                "pitcher_pressure_index": (
                    awayStats.get("pitchesPerInning", 0)
                ),

                # ----------------- WALK / DISCIPLINE ADVANTAGE -----------------
                "discipline_advantage": (
                    awayStats.get("walkToStrikeoutRatio", 0) -
                    homeStats.get("walkToStrikeoutRatio", 0)
                ),

                # ----------------- LEVERAGE & SCORING MOMENTUM -----------------
                "run_creation_momentum": (
                    awayStats.get("runsCreated", 0) /
                    max(1, awayStats.get("plateAppearances", 1))
                ),
                "xrun_proxy": (
                    (awayStats.get("onBasePct", 0) * awayStats.get("slugAvg", 0))
                ),

                # ----------------- OPPONENT PITCHING VULNERABILITY -----------------
                "opp_pitching_damage_rate": (
                    homeStats.get("earnedRuns", 0) /
                    max(1, homeStats.get("innings", 1))
                ),
                "opp_hr_vulnerability": (
                    homeStats.get("homeRuns", 0) /
                    max(1, homeStats.get("battersFaced", 1))
                ),

                # ----------------- TOTAL OFFENSIVE PRESSURE -----------------
                "offensive_pressure_index": (
                    (awayStats.get("plateAppearances", 0) + awayStats.get("totalBases", 0)) /
                    max(1, awayStats.get("gamesPlayed", 1))
                ),
            }


        # ---- Existing scoring history ----
        home_hist = team_history.get(home_id, [])
        away_hist = team_history.get(away_id, [])
        home_home_hist = team_home_history.get(home_id, [])
        away_away_hist = team_away_history.get(away_id, [])

        # Helper rolling average
        def ra(hist, n): return np.mean(hist[-n:]) if hist else 0

        # Rolling averages, std, trends
        home_avg_last5 = ra(home_hist, 5)
        home_avg_last10 = ra(home_hist, 10)
        away_avg_last5 = ra(away_hist, 5)
        away_avg_last10 = ra(away_hist, 10)
        home_avg_last5_home = ra(home_home_hist, 5)
        home_avg_last10_home = ra(home_home_hist, 10)
        away_avg_last5_away = ra(away_away_hist, 5)
        away_avg_last10_away = ra(away_away_hist, 10)
        home_std_last5 = np.std(home_hist[-5:]) if len(home_hist) >= 2 else 0
        away_std_last5 = np.std(away_hist[-5:]) if len(away_hist) >= 2 else 0
        home_trend = np.polyfit(range(len(home_hist[-5:])), home_hist[-5:], 1)[0] if len(home_hist[-5:]) >= 2 else 0
        away_trend = np.polyfit(range(len(away_hist[-5:])), away_hist[-5:], 1)[0] if len(away_hist[-5:]) >= 2 else 0
        home_score_diff_last = home_hist[-1]-home_hist[-2] if len(home_hist)>=2 else 0
        away_score_diff_last = away_hist[-1]-away_hist[-2] if len(away_hist)>=2 else 0
        home_avg_last3 = ra(home_hist, 3)
        away_avg_last3 = ra(away_hist, 3)
        home_slope_3_vs_10 = home_avg_last3 - home_avg_last10
        away_slope_3_vs_10 = away_avg_last3 - away_avg_last10
        home_q75 = np.percentile(home_hist[-10:], 75) if home_hist else 0
        home_q25 = np.percentile(home_hist[-10:], 25) if home_hist else 0
        away_q75 = np.percentile(away_hist[-10:], 75) if away_hist else 0
        away_q25 = np.percentile(away_hist[-10:], 25) if away_hist else 0
        home_streak = calc_streak(home_hist)
        away_streak = calc_streak(away_hist)
        home_rest = rest_days(home_id, game, last_games_info)
        away_rest = rest_days(away_id, game, last_games_info)
        vs_opp_home = get_vs_opp_features(home_id, away_id, team_vs_team_history)
        vs_opp_away = get_vs_opp_features(away_id, home_id, team_vs_team_history)

        # ---- Build features ----
        def make_features(perspective):
            if perspective=="home":
                t_stats, o_stats = homeStats, awayStats
                t_id, o_id = home_id, away_id
                t_avg_last5, t_avg_last10 = home_avg_last5, home_avg_last10
                t_avg_last5_home, t_avg_last10_home = home_avg_last5_home, home_avg_last10_home
                t_std_last5, t_trend = home_std_last5, home_trend
                t_diff_last, t_avg_last3 = home_score_diff_last, home_avg_last3
                t_slope_3_vs_10, t_q75, t_q25 = home_slope_3_vs_10, home_q75, home_q25
                t_streak, t_rest = home_streak, home_rest
                o_avg_last5, o_avg_last10 = away_avg_last5, away_avg_last10
                o_avg_last5_away, o_avg_last10_away = away_avg_last5_away, away_avg_last10_away
                o_std_last5, o_trend = away_std_last5, away_trend
                o_diff_last, o_avg_last3 = away_score_diff_last, away_avg_last3
                o_slope_3_vs_10, o_q75, o_q25 = away_slope_3_vs_10, away_q75, away_q25
                o_streak, o_rest = away_streak, away_rest
                vs_opp = vs_opp_home
                elo_team, elo_opp = pre_elo_home, pre_elo_away
                sos_team, sos_team_last5 = sos_home, sos_home_last5
                sos_opp, sos_opp_last5 = sos_away, sos_away_last5
                srs_team, srs_team_last5 = srs_home, srs_home_last5
                srs_opp, srs_opp_last5 = srs_away, srs_away_last5
            else:
                t_stats, o_stats = awayStats, homeStats
                t_id, o_id = away_id, home_id
                t_avg_last5, t_avg_last10 = away_avg_last5, away_avg_last10
                t_avg_last5_home, t_avg_last10_home = away_avg_last5_away, away_avg_last10_away
                t_std_last5, t_trend = away_std_last5, away_trend
                t_diff_last, t_avg_last3 = away_score_diff_last, away_avg_last3
                t_slope_3_vs_10, t_q75, t_q25 = away_slope_3_vs_10, away_q75, away_q25
                t_streak, t_rest = away_streak, away_rest
                o_avg_last5, o_avg_last10 = home_avg_last5, home_avg_last10
                o_avg_last5_away, o_avg_last10_away = home_avg_last5_home, home_avg_last10_home
                o_std_last5, o_trend = home_std_last5, home_trend
                o_diff_last, o_avg_last3 = home_score_diff_last, home_avg_last3
                o_slope_3_vs_10, o_q75, o_q25 = home_slope_3_vs_10, home_q75, home_q25
                o_streak, o_rest = home_streak, home_rest
                vs_opp = vs_opp_away
                elo_team, elo_opp = pre_elo_away, pre_elo_home
                sos_team, sos_team_last5 = sos_away, sos_away_last5
                sos_opp, sos_opp_last5 = sos_home, sos_home_last5
                srs_team, srs_team_last5 = srs_away, srs_away_last5
                srs_opp, srs_opp_last5 = srs_home, srs_home_last5
            
            sport_features = sport_features_home if perspective == "home" else sport_features_away

            features = {
                **{f"team_{k}": to_number(v) for k,v in t_stats.items()},
                **{f"opponent_{k}": to_number(v) for k,v in o_stats.items()},
                **{f"diff_{k}": to_number(t_stats[k])-to_number(o_stats[k]) for k in required_keys},
                "is_home": 1 if perspective=="home" else 0,
                "avg_diff": t_avg_last5 - o_avg_last5,
                "home_avg_last5": t_avg_last5,
                "home_avg_last10": t_avg_last10,
                "home_avg_last5_home": t_avg_last5_home,
                "home_avg_last10_home": t_avg_last10_home,
                "home_score_std_last5": t_std_last5,
                "home_score_trend": t_trend,
                "home_score_diff_last": t_diff_last,
                "home_avg_last3": t_avg_last3,
                "home_score_q75_last10": t_q75,
                "home_score_q25_last10": t_q25,
                "home_slope_3_vs_10": t_slope_3_vs_10,
                "home_streak": t_streak,
                "home_rest": t_rest,
                "away_avg_last5": o_avg_last5,
                "away_avg_last10": o_avg_last10,
                "away_avg_last5_away": o_avg_last5_away,
                "away_avg_last10_away": o_avg_last10_away,
                "away_score_std_last5": o_std_last5,
                "away_score_trend": o_trend,
                "away_score_diff_last": o_diff_last,
                "away_avg_last3": o_avg_last3,
                "away_score_q75_last10": o_q75,
                "away_score_q25_last10": o_q25,
                "away_slope_3_vs_10": o_slope_3_vs_10,
                "away_streak": o_streak,
                "away_rest": o_rest,
                **sport_features,
                # ----- NEW FEATURES -----
                "elo_pre": elo_team,
                "opp_elo_pre": elo_opp,
                "elo_last5_slope": (np.polyfit(range(len(team_elo_history[t_id][-5:])), team_elo_history[t_id][-5:], 1)[0] if len(team_elo_history[t_id][-5:])>=2 else 0),
                "elo_vol_last5": np.std(team_elo_history[t_id][-5:]) if len(team_elo_history[t_id][-5:])>=2 else 0,
                "team_sos": sos_team,
                "team_sos_last5": sos_team_last5,
                "opp_sos": sos_opp,
                "opp_sos_last5": sos_opp_last5,
                "srs": srs_team,
                "srs_last5": srs_team_last5,
                "opp_srs": srs_opp,
                "opp_srs_last5": srs_opp_last5,
                **vs_opp,
            }
            return features

        home_features = make_features("home")
        away_features = make_features("away")

        feature_list.append(home_features)
        feature_list.append(away_features)
        score_label_list.append(game.homeScore)
        score_label_list.append(game.awayScore)
        win_label_list.append(1 if game.winner=="home" else 0)
        win_label_list.append(1 if game.winner=="away" else 0)

        # ---- UPDATE ELO ----
        point_diff = game.homeScore - game.awayScore
        abs_diff = abs(point_diff)
        exp_home = 1 / (1 + 10 ** (-(pre_elo_home + HOME_ADV - pre_elo_away) / 400))
        exp_away = 1 - exp_home
        actual_home = 1 if point_diff>0 else 0
        actual_away = 1 - actual_home
        mov_mult = math.log(abs_diff+1) * (2.2 / ((pre_elo_home-pre_elo_away)*0.001 + 2.2))
        team_elo[home_id] += K * mov_mult * (actual_home - exp_home)
        team_elo[away_id] += K * mov_mult * (actual_away - exp_away)
        team_elo_history[home_id].append(team_elo[home_id])
        team_elo_history[away_id].append(team_elo[away_id])

        # ---- UPDATE SCORE HISTORIES ----
        team_history.setdefault(home_id, []).append(game.homeScore)
        team_history.setdefault(away_id, []).append(game.awayScore)
        team_home_history.setdefault(home_id, []).append(game.homeScore)
        team_away_history.setdefault(away_id, []).append(game.awayScore)
        last_games_info.setdefault(home_id, []).append((game.commence_time, game.homeScore, game.awayScore))
        last_games_info.setdefault(away_id, []).append((game.commence_time, game.awayScore, game.homeScore))
        team_vs_team_history.setdefault(home_id, {}).setdefault(away_id, []).append({"date": game.commence_time, "team_score": game.homeScore, "opp_score": game.awayScore})
        team_vs_team_history.setdefault(away_id, {}).setdefault(home_id, []).append({"date": game.commence_time, "team_score": game.awayScore, "opp_score": game.homeScore})

    return feature_list, score_label_list, win_label_list


def feature_extraction_single(game, sport,
                              team_history, last_games_info,
                              team_home_history, team_away_history,
                              team_vs_team_history,
                              team_elo, team_elo_history,
                              team_sos_components, last_seen_season_month):
    """
    Extract features for a single game including Elo, SOS, and SRS.
    Returns [home_features, away_features].
    """

    home_id = game.homeTeamDetails.id
    away_id = game.awayTeamDetails.id
    game_month = game.commence_time.month
    BASE_ELO = 1500

    # ---- Season reset ----
    for tid in [home_id, away_id]:
        if (tid not in last_seen_season_month or
            (game_month == sport.startMonth and
                last_seen_season_month.get(tid) != game_month)):
            team_elo[tid] = BASE_ELO
            team_elo_history[tid] = []
            team_sos_components[tid] = []

        last_seen_season_month[tid] = game_month

    # Defaults
    team_elo.setdefault(home_id, BASE_ELO)
    team_elo.setdefault(away_id, BASE_ELO)
    team_elo_history.setdefault(home_id, [])
    team_elo_history.setdefault(away_id, [])
    team_sos_components.setdefault(home_id, [])
    team_sos_components.setdefault(away_id, [])

    pre_elo_home = team_elo[home_id]
    pre_elo_away = team_elo[away_id]

    # Add opponent Elo for SOS
    team_sos_components[home_id].append(pre_elo_away)
    team_sos_components[away_id].append(pre_elo_home)

    # Compute SOS
    sos_home = np.mean(team_sos_components[home_id][:-1]) if len(team_sos_components[home_id]) > 1 else BASE_ELO
    sos_away = np.mean(team_sos_components[away_id][:-1]) if len(team_sos_components[away_id]) > 1 else BASE_ELO
    sos_home_last5 = np.mean(team_sos_components[home_id][-6:-1]) if len(team_sos_components[home_id]) > 5 else sos_home
    sos_away_last5 = np.mean(team_sos_components[away_id][-6:-1]) if len(team_sos_components[away_id]) > 5 else sos_away

    # SRS
    srs_home = pre_elo_home - sos_home
    srs_away = pre_elo_away - sos_away
    elo_hist_home = team_elo_history.get(home_id, [])
    elo_hist_away = team_elo_history.get(away_id, [])
    srs_home_last5 = np.mean([e - s for e, s in zip(elo_hist_home[-5:], team_sos_components[home_id][-6:-1])]) if len(elo_hist_home) >= 1 else srs_home
    srs_away_last5 = np.mean([e - s for e, s in zip(elo_hist_away[-5:], team_sos_components[away_id][-6:-1])]) if len(elo_hist_away) >= 1 else srs_away

    # ---- Stats ----
    homeStats = game.homeStats.data
    awayStats = game.awayStats.data
    if stat_config_map:
        config = stat_config_map.get(getattr(sport, "name", None))
        required_keys = config.get("default", [])
        homeStats = {k: homeStats.get(k, 0) for k in required_keys}
        awayStats = {k: awayStats.get(k, 0) for k in required_keys}
    else:
        required_keys = list(homeStats.keys())

    sport_features_home = {}
    sport_features_away = {}

    if sport.name == 'americanfootball_ncaaf':
        sport_features_home = {
            # ---------------- TEMPO ----------------
            "seconds_per_play": (
                homeStats.get("possessionTimeSeconds", 0) / max(1, homeStats.get("totalOffensivePlays", 1))
            ),
            "plays_per_minute": (
                homeStats.get("totalOffensivePlays", 0) /
                max(1, homeStats.get("possessionTimeSeconds", 1) / 60)
            ),
            "rush_pass_ratio": (
                homeStats.get("rushingAttempts", 0) /
                max(1, homeStats.get("passingAttempts", 1))
            ),
            # ---------------- DRIVE EFFICIENCY ----------------
            "points_per_drive": (
                homeStats.get("totalPoints", 0) / max(1, homeStats.get("totalDrives", 1))
            ),
            "yards_per_drive": (
                homeStats.get("totalYards", 0) / max(1, homeStats.get("totalDrives", 1))
            ),
            "touchdowns_per_drive": (
                homeStats.get("totalTouchdowns", 0) / max(1, homeStats.get("totalDrives", 1))
            ),
            # ---------------- SPECIAL TEAMS VALUE ----------------
            "kick_return_explosive_rate": (
                homeStats.get("kickReturnYards", 0) /
                max(1, homeStats.get("kickReturns", 1))
            ),
            "punting_efficiency": (
                homeStats.get("grossAvgPuntYards", 0) *
                (homeStats.get("puntsInside20Pct", 0))
            ),
            # ---------------- PASS PROTECTION / OL ----------------
            "pressure_allowed_rate": (
                homeStats.get("hurries", 0) /
                max(1, homeStats.get("totalOffensivePlays", 1))
            ),
            "sack_rate_allowed": (
                homeStats.get("sacks", 0) /
                max(1, homeStats.get("passingAttempts", 1))
            ),
            "run_stuff_rate": (
                homeStats.get("rushingAttempts", 0) / 
                max(1, homeStats.get("rushingYards", 1)) 
                if homeStats.get("rushingYards", 0) < 1 else 0
            ), # safe fallback approx
            # ---------------- TURNOVER DERIVED ----------------
            "turnovers_per_drive": (
                (homeStats.get("interceptions", 0) + homeStats.get("fumbles", 0)) /
                max(1, homeStats.get("totalDrives", 1))
            ),
            "interception_rate": (
                homeStats.get("interceptions", 0) /
                max(1, homeStats.get("passingAttempts", 1))
            ),
            "fumble_rate": (
                homeStats.get("fumbles", 0) /
                max(1, homeStats.get("totalOffensivePlays", 1))
            ),
            # ---------------- PENALTY IMPACT ----------------
            "off_penalty_kill_rate": (
                homeStats.get("totalPenaltyYards", 0) /
                max(1, homeStats.get("totalYards", 1))
            ),
            "penalties_per_play": (
                homeStats.get("totalPenalties", 0) /
                max(1, homeStats.get("totalOffensivePlays", 1))
            ),
            # --------------- OPPONENT-ADJUSTMENT METRICS (NON-DUPLICATE DIFFS) ---------------
            "opp_def_ypp_diff": (
                awayStats.get("yardsPerGame", 0) -
                awayStats.get("yardsAllowed", 0)   # mixing stats → allowed
            ),
            # ---------------- FIELD POSITION PROXY ----------------
            "special_teams_hidden_yards": (
                homeStats.get("kickReturnYards", 0)
                + homeStats.get("puntYards", 0)
                - awayStats.get("kickReturnYards", 0)
                - awayStats.get("puntYards", 0)
            ),
        }
        sport_features_away = {
            # ---------------- TEMPO ----------------
            "seconds_per_play": (
                awayStats.get("possessionTimeSeconds", 0) / max(1, awayStats.get("totalOffensivePlays", 1))
            ),
            "plays_per_minute": (
                awayStats.get("totalOffensivePlays", 0) /
                max(1, awayStats.get("possessionTimeSeconds", 1) / 60)
            ),
            "rush_pass_ratio": (
                awayStats.get("rushingAttempts", 0) /
                max(1, awayStats.get("passingAttempts", 1))
            ),

            # ---------------- DRIVE EFFICIENCY ----------------
            "points_per_drive": (
                awayStats.get("totalPoints", 0) / max(1, awayStats.get("totalDrives", 1))
            ),
            "yards_per_drive": (
                awayStats.get("totalYards", 0) / max(1, awayStats.get("totalDrives", 1))
            ),
            "touchdowns_per_drive": (
                awayStats.get("totalTouchdowns", 0) / max(1, awayStats.get("totalDrives", 1))
            ),

            # ---------------- SPECIAL TEAMS VALUE ----------------
            "kick_return_explosive_rate": (
                awayStats.get("kickReturnYards", 0) /
                max(1, awayStats.get("kickReturns", 1))
            ),
            "punting_efficiency": (
                awayStats.get("grossAvgPuntYards", 0) *
                (awayStats.get("puntsInside20Pct", 0))
            ),

            # ---------------- PASS PROTECTION / OL ----------------
            "pressure_allowed_rate": (
                awayStats.get("hurries", 0) /
                max(1, awayStats.get("totalOffensivePlays", 1))
            ),
            "sack_rate_allowed": (
                awayStats.get("sacks", 0) /
                max(1, awayStats.get("passingAttempts", 1))
            ),
            "run_stuff_rate": (
                awayStats.get("rushingAttempts", 0) / 
                max(1, awayStats.get("rushingYards", 1))
                if awayStats.get("rushingYards", 0) < 1 else 0
            ),

            # ---------------- TURNOVER DERIVED ----------------
            "turnovers_per_drive": (
                (awayStats.get("interceptions", 0) + awayStats.get("fumbles", 0)) /
                max(1, awayStats.get("totalDrives", 1))
            ),
            "interception_rate": (
                awayStats.get("interceptions", 0) /
                max(1, awayStats.get("passingAttempts", 1))
            ),
            "fumble_rate": (
                awayStats.get("fumbles", 0) /
                max(1, awayStats.get("totalOffensivePlays", 1))
            ),

            # ---------------- PENALTY IMPACT ----------------
            "off_penalty_kill_rate": (
                awayStats.get("totalPenaltyYards", 0) /
                max(1, awayStats.get("totalYards", 1))
            ),
            "penalties_per_play": (
                awayStats.get("totalPenalties", 0) /
                max(1, awayStats.get("totalOffensivePlays", 1))
            ),

            # --------------- OPPONENT-ADJUSTMENT METRICS ---------------
            "opp_def_ypp_diff": (
                homeStats.get("yardsPerGame", 0) -
                homeStats.get("yardsAllowed", 0)
            ),

            # ---------------- FIELD POSITION PROXY ----------------
            "special_teams_hidden_yards": (
                awayStats.get("kickReturnYards", 0)
                + awayStats.get("puntYards", 0)
                - homeStats.get("kickReturnYards", 0)
                - homeStats.get("puntYards", 0)
            ),
        }
    elif sport.name == 'americanfootball_nfl':
        sport_features_home = {

        # ---------------- TEMPO ----------------
        "seconds_per_play": (
            homeStats.get("possessionTimeSeconds", 0) /
            max(1, homeStats.get("totalOffensivePlays", 1))
        ),
        "plays_per_minute": (
            homeStats.get("totalOffensivePlays", 0) /
            max(1, homeStats.get("possessionTimeSeconds", 1) / 60)
        ),
        "rush_pass_ratio": (
            homeStats.get("rushingAttempts", 0) /
            max(1, homeStats.get("passingAttempts", 1))
        ),

        # ---------------- DRIVE EFFICIENCY ----------------
        "points_per_drive": (
            homeStats.get("totalPoints", 0) /
            max(1, homeStats.get("totalDrives", 1))
        ),
        "yards_per_drive": (
            homeStats.get("totalYards", 0) /
            max(1, homeStats.get("totalDrives", 1))
        ),
        "touchdowns_per_drive": (
            homeStats.get("totalTouchdowns", 0) /
            max(1, homeStats.get("totalDrives", 1))
        ),
        "third_down_success_rate": (
            homeStats.get("thirdDownConvs", 0) /
            max(1, homeStats.get("thirdDownAttempts", 1))
        ),

        # ---------------- PASS PROTECTION ----------------
        "pressure_rate_allowed": (
            homeStats.get("stuffs", 0) + homeStats.get("tacklesForLoss", 0)
        ) / max(1, homeStats.get("totalOffensivePlays", 1)),
        "sack_rate_allowed": (
            homeStats.get("sacks", 0) /
            max(1, homeStats.get("passingAttempts", 1))
        ),

        # ---------------- TURNOVER DERIVED ----------------
        "turnovers_per_drive": (
            (homeStats.get("interceptions", 0) + homeStats.get("kickoffReturns", 0)) /
            max(1, homeStats.get("totalDrives", 1))
        ),
        "interception_rate": (
            homeStats.get("interceptions", 0) /
            max(1, homeStats.get("passingAttempts", 1))
        ),

        # ---------------- PENALTY IMPACT ----------------
        "penalties_per_play": (
            homeStats.get("totalPenalties", 0) /
            max(1, homeStats.get("totalOffensivePlays", 1))
        ),
        "penalty_yards_per_play": (
            homeStats.get("totalPenaltyYards", 0) /
            max(1, homeStats.get("totalOffensivePlays", 1))
        ),
        "penalty_kill_rate": (
            homeStats.get("totalPenaltyYards", 0) /
            max(1, homeStats.get("totalYards", 1))
        ),

        # ---------------- SPECIAL TEAMS VALUE ----------------
        "punt_efficiency": (
            homeStats.get("grossAvgPuntYards", 0) *
            homeStats.get("puntsInside20Pct", 0)
        ),
        "kick_return_explosive_rate": (
            homeStats.get("kickReturnYards", 0) /
            max(1, homeStats.get("kickReturns", 1))
        ),
        "avg_hidden_yards_special_teams": (
            homeStats.get("kickoffYards", 0)
            + homeStats.get("puntYards", 0)
            - awayStats.get("kickoffYards", 0)
            - awayStats.get("puntYards", 0)
        ),

        # ---------------- OPPONENT DEFENSE ADJUSTMENTS (cross-stat diffs OK) ----------------
        "opp_def_yards_allowed_per_play": (
            awayStats.get("yardsAllowed", 0) /
            max(1, awayStats.get("totalDefensivePlays", awayStats.get("totalOffensivePlays", 1)))
        ),
        "opp_pass_rush_pressure_proxy": (
            awayStats.get("sacks", 0) + awayStats.get("tacklesForLoss", 0)
        ),
    }
        sport_features_away = {

            # ---------------- TEMPO ----------------
            "seconds_per_play": (
                awayStats.get("possessionTimeSeconds", 0) /
                max(1, awayStats.get("totalOffensivePlays", 1))
            ),
            "plays_per_minute": (
                awayStats.get("totalOffensivePlays", 0) /
                max(1, awayStats.get("possessionTimeSeconds", 1) / 60)
            ),
            "rush_pass_ratio": (
                awayStats.get("rushingAttempts", 0) /
                max(1, awayStats.get("passingAttempts", 1))
            ),

            # ---------------- DRIVE EFFICIENCY ----------------
            "points_per_drive": (
                awayStats.get("totalPoints", 0) /
                max(1, awayStats.get("totalDrives", 1))
            ),
            "yards_per_drive": (
                awayStats.get("totalYards", 0) /
                max(1, awayStats.get("totalDrives", 1))
            ),
            "touchdowns_per_drive": (
                awayStats.get("totalTouchdowns", 0) /
                max(1, awayStats.get("totalDrives", 1))
            ),
            "third_down_success_rate": (
                awayStats.get("thirdDownConvs", 0) /
                max(1, awayStats.get("thirdDownAttempts", 1))
            ),

            # ---------------- PASS PROTECTION ----------------
            "pressure_rate_allowed": (
                awayStats.get("stuffs", 0) + awayStats.get("tacklesForLoss", 0)
            ) / max(1, awayStats.get("totalOffensivePlays", 1)),
            "sack_rate_allowed": (
                awayStats.get("sacks", 0) /
                max(1, awayStats.get("passingAttempts", 1))
            ),

            # ---------------- TURNOVER DERIVED ----------------
            "turnovers_per_drive": (
                (awayStats.get("interceptions", 0) + awayStats.get("kickoffReturns", 0)) /
                max(1, awayStats.get("totalDrives", 1))
            ),
            "interception_rate": (
                awayStats.get("interceptions", 0) /
                max(1, awayStats.get("passingAttempts", 1))
            ),

            # ---------------- PENALTY IMPACT ----------------
            "penalties_per_play": (
                awayStats.get("totalPenalties", 0) /
                max(1, awayStats.get("totalOffensivePlays", 1))
            ),
            "penalty_yards_per_play": (
                awayStats.get("totalPenaltyYards", 0) /
                max(1, awayStats.get("totalOffensivePlays", 1))
            ),
            "penalty_kill_rate": (
                awayStats.get("totalPenaltyYards", 0) /
                max(1, awayStats.get("totalYards", 1))
            ),

            # ---------------- SPECIAL TEAMS VALUE ----------------
            "punt_efficiency": (
                awayStats.get("grossAvgPuntYards", 0) *
                awayStats.get("puntsInside20Pct", 0)
            ),
            "kick_return_explosive_rate": (
                awayStats.get("kickReturnYards", 0) /
                max(1, awayStats.get("kickReturns", 1))
            ),
            "avg_hidden_yards_special_teams": (
                awayStats.get("kickoffYards", 0)
                + awayStats.get("puntYards", 0)
                - homeStats.get("kickoffYards", 0)
                - homeStats.get("puntYards", 0)
            ),

            # ---------------- OPPONENT DEFENSE ADJUSTMENTS ----------------
            "opp_def_yards_allowed_per_play": (
                homeStats.get("yardsAllowed", 0) /
                max(1, homeStats.get("totalDefensivePlays", homeStats.get("totalOffensivePlays", 1)))
            ),
            "opp_pass_rush_pressure_proxy": (
                homeStats.get("sacks", 0) + homeStats.get("tacklesForLoss", 0)
            ),
        }
    elif sport.name == 'basketball_nba':
        sport_features_home = {

            # ---------------- PACE / TEMPO ----------------
            "pace_factor": (
                homeStats.get("estimatedPossessions", 0) / max(1, homeStats.get("gamesPlayed", 1))
            ),
            "opp_pace_factor": (
                awayStats.get("estimatedPossessions", 0) / max(1, awayStats.get("gamesPlayed", 1))
            ),
            "pace_ratio": (
                homeStats.get("estimatedPossessions", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- SHOT PROFILE COMPOSITION ----------------
            "three_point_rate": (
                homeStats.get("threePointFieldGoalsAttempted", 0) /
                max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),
            "two_point_rate": (
                homeStats.get("twoPointFieldGoalsAttempted", 0) /
                max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),
            "free_throw_rate": (
                homeStats.get("freeThrowsAttempted", 0) /
                max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),
            "paint_scoring_rate": (
                homeStats.get("pointsInPaint", 0) /
                max(1, homeStats.get("points", 1))
            ),
            "fast_break_rate": (
                homeStats.get("fastBreakPoints", 0) /
                max(1, homeStats.get("points", 1))
            ),

            # ---------------- SHOT QUALITY PROXIES ----------------
            "effective_shot_mix_value": (
                (
                    3 * homeStats.get("threePointFieldGoalsMade", 0)
                    + 2 * homeStats.get("twoPointFieldGoalsMade", 0)
                    + homeStats.get("freeThrowsMade", 0)
                ) / max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),
            "shot_creation_efficiency": (
                homeStats.get("assists", 0) /
                max(1, homeStats.get("fieldGoalsMade", 1))
            ),

            # ---------------- REBOUND IMPACT ----------------
            "rebound_pressure_ratio": (
                homeStats.get("offensiveRebounds", 0) /
                max(1, awayStats.get("defensiveRebounds", 1))
            ),
            "second_chance_rate": (
                homeStats.get("offensiveRebounds", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- TURNOVER IMPACT / BALL SECURITY ----------------
            "turnover_rate": (
                homeStats.get("turnovers", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "opp_turnover_pressure": (
                awayStats.get("steals", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "live_ball_turnover_ratio": (
                homeStats.get("steals", 0) /
                max(1, homeStats.get("turnovers", 1))
            ),

            # ---------------- FOUL / FREE THROW PRESSURE ----------------
            "foul_pressure_rate": (
                homeStats.get("fouls", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "opp_foul_draw_rate": (
                awayStats.get("fouls", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- DEFENSIVE DISRUPTION ON OPPONENT ----------------
            "opp_block_pressure": (
                awayStats.get("blocks", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "opp_steal_disruption": (
                awayStats.get("steals", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- POSSESSION VALUE ADD ----------------
            "points_per_possession_est": (
                homeStats.get("points", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "assist_ratio": (
                homeStats.get("assists", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "free_throw_points_ratio": (
                homeStats.get("freeThrowsMade", 0) * 1.0 /
                max(1, homeStats.get("points", 1))
            ),

            # ---------------- OPPONENT DEFENSE ADJUSTMENTS ----------------
            "opp_rebound_strength": (
                awayStats.get("totalRebounds", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
            "opp_def_disruption_rate": (
                (awayStats.get("steals", 0) + awayStats.get("blocks", 0)) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "opp_shot_defense_efficiency": (
                awayStats.get("fieldGoalsAttempted", 0) -
                awayStats.get("fieldGoalsMade", 0)
            ) / max(1, awayStats.get("fieldGoalsAttempted", 1)),
        }
        sport_features_away = {

            # ---------------- PACE / TEMPO ----------------
            "pace_factor": (
                awayStats.get("estimatedPossessions", 0) / max(1, awayStats.get("gamesPlayed", 1))
            ),
            "opp_pace_factor": (
                homeStats.get("estimatedPossessions", 0) / max(1, homeStats.get("gamesPlayed", 1))
            ),
            "pace_ratio": (
                awayStats.get("estimatedPossessions", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- SHOT PROFILE COMPOSITION ----------------
            "three_point_rate": (
                awayStats.get("threePointFieldGoalsAttempted", 0) /
                max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),
            "two_point_rate": (
                awayStats.get("twoPointFieldGoalsAttempted", 0) /
                max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),
            "free_throw_rate": (
                awayStats.get("freeThrowsAttempted", 0) /
                max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),
            "paint_scoring_rate": (
                awayStats.get("pointsInPaint", 0) /
                max(1, awayStats.get("points", 1))
            ),
            "fast_break_rate": (
                awayStats.get("fastBreakPoints", 0) /
                max(1, awayStats.get("points", 1))
            ),

            # ---------------- SHOT QUALITY PROXIES ----------------
            "effective_shot_mix_value": (
                (
                    3 * awayStats.get("threePointFieldGoalsMade", 0)
                    + 2 * awayStats.get("twoPointFieldGoalsMade", 0)
                    + awayStats.get("freeThrowsMade", 0)
                ) / max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),
            "shot_creation_efficiency": (
                awayStats.get("assists", 0) /
                max(1, awayStats.get("fieldGoalsMade", 1))
            ),

            # ---------------- REBOUND IMPACT ----------------
            "rebound_pressure_ratio": (
                awayStats.get("offensiveRebounds", 0) /
                max(1, homeStats.get("defensiveRebounds", 1))
            ),
            "second_chance_rate": (
                awayStats.get("offensiveRebounds", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- TURNOVER IMPACT ----------------
            "turnover_rate": (
                awayStats.get("turnovers", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "opp_turnover_pressure": (
                homeStats.get("steals", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "live_ball_turnover_ratio": (
                awayStats.get("steals", 0) /
                max(1, awayStats.get("turnovers", 1))
            ),

            # ---------------- FOUL / FREE THROW PRESSURE ----------------
            "foul_pressure_rate": (
                awayStats.get("fouls", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "opp_foul_draw_rate": (
                homeStats.get("fouls", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- DEFENSIVE DISRUPTION ----------------
            "opp_block_pressure": (
                homeStats.get("blocks", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "opp_steal_disruption": (
                homeStats.get("steals", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- POSSESSION VALUE ADD ----------------
            "points_per_possession_est": (
                awayStats.get("points", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "assist_ratio": (
                awayStats.get("assists", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "free_throw_points_ratio": (
                awayStats.get("freeThrowsMade", 0) * 1.0 /
                max(1, awayStats.get("points", 1))
            ),

            # ---------------- OPPONENT DEFENSE ADJUSTMENTS ----------------
            "opp_rebound_strength": (
                homeStats.get("totalRebounds", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
            "opp_def_disruption_rate": (
                (homeStats.get("steals", 0) + homeStats.get("blocks", 0)) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "opp_shot_defense_efficiency": (
                homeStats.get("fieldGoalsAttempted", 0) -
                homeStats.get("fieldGoalsMade", 0)
            ) / max(1, homeStats.get("fieldGoalsAttempted", 1)),

        }
    elif sport.name == 'basketball_ncaab':
        sport_features_home = {

            # ---------------- PACE / TEMPO ----------------
            "pace_factor": (
                homeStats.get("estimatedPossessions", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
            "opp_pace_factor": (
                awayStats.get("estimatedPossessions", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
            "pace_ratio": (
                homeStats.get("estimatedPossessions", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- SHOT PROFILE COMPOSITION ----------------
            "three_point_rate": (
                homeStats.get("threePointFieldGoalsAttempted", 0) /
                max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),
            "two_point_rate": (
                homeStats.get("twoPointFieldGoalsAttempted", 0) /
                max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),
            "free_throw_rate": (
                homeStats.get("freeThrowsAttempted", 0) /
                max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),

            # ---------------- SHOT QUALITY PROXIES ----------------
            "shot_creation_efficiency": (
                homeStats.get("assists", 0) /
                max(1, homeStats.get("fieldGoalsMade", 1))
            ),
            "effective_shot_mix_value": (
                (
                    3 * homeStats.get("threePointFieldGoalsMade", 0)
                    + 2 * homeStats.get("twoPointFieldGoalsMade", 0)
                    + homeStats.get("freeThrowsMade", 0)
                ) / max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),

            # ---------------- REBOUND LEVERAGE ----------------
            "rebound_pressure_ratio": (
                homeStats.get("offensiveRebounds", 0) /
                max(1, awayStats.get("defensiveRebounds", 1))
            ),
            "second_chance_rate": (
                homeStats.get("offensiveRebounds", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- PAINT AND TRANSITION SCORING ----------------
            "fast_break_rate": (
                homeStats.get("fastBreakPoints", 0) /
                max(1, homeStats.get("points", 1))
            ),

            # ---------------- TURNOVER PRESSURE ----------------
            "turnover_rate": (
                homeStats.get("turnovers", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "live_ball_turnover_ratio": (
                homeStats.get("steals", 0) /
                max(1, homeStats.get("turnovers", 1))
            ),
            "opp_turnover_pressure": (
                awayStats.get("steals", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- FOUL PRESSURE / FT DAMAGE ----------------
            "foul_pressure_rate": (
                homeStats.get("fouls", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "free_throw_points_ratio": (
                homeStats.get("freeThrowsMade", 0) /
                max(1, homeStats.get("points", 1))
            ),

            # ---------------- DEFENSIVE DISRUPTION ----------------
            "def_disruption_rate": (
                (homeStats.get("blocks", 0) + homeStats.get("steals", 0)) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "opp_shot_disruption": (
                (awayStats.get("blocks", 0) + awayStats.get("steals", 0)) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- SCORE EFFICIENCY / POSSESSION VALUE ----------------
            "points_per_possession_est": (
                homeStats.get("points", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "assist_ratio": (
                homeStats.get("assists", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- OPPONENT REBOUND DEFENSE ----------------
            "opp_rebound_strength": (
                awayStats.get("totalRebounds", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),

            # ---------------- OPPONENT SHOOTING RESISTANCE ----------------
            "opp_effective_fg_resistance": (
                (
                    awayStats.get("fieldGoalsAttempted", 0)
                    - awayStats.get("fieldGoalsMade", 0)
                ) / max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),
        }
        sport_features_away = {

            # ---------------- PACE / TEMPO ----------------
            "pace_factor": (
                awayStats.get("estimatedPossessions", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
            "opp_pace_factor": (
                homeStats.get("estimatedPossessions", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
            "pace_ratio": (
                awayStats.get("estimatedPossessions", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- SHOT PROFILE COMPOSITION ----------------
            "three_point_rate": (
                awayStats.get("threePointFieldGoalsAttempted", 0) /
                max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),
            "two_point_rate": (
                awayStats.get("twoPointFieldGoalsAttempted", 0) /
                max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),
            "free_throw_rate": (
                awayStats.get("freeThrowsAttempted", 0) /
                max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),

            # ---------------- SHOT QUALITY PROXIES ----------------
            "shot_creation_efficiency": (
                awayStats.get("assists", 0) /
                max(1, awayStats.get("fieldGoalsMade", 1))
            ),
            "effective_shot_mix_value": (
                (
                    3 * awayStats.get("threePointFieldGoalsMade", 0)
                    + 2 * awayStats.get("twoPointFieldGoalsMade", 0)
                    + awayStats.get("freeThrowsMade", 0)
                ) / max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),

            # ---------------- REBOUND LEVERAGE ----------------
            "rebound_pressure_ratio": (
                awayStats.get("offensiveRebounds", 0) /
                max(1, homeStats.get("defensiveRebounds", 1))
            ),
            "second_chance_rate": (
                awayStats.get("offensiveRebounds", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- PAINT / TRANSITION ----------------
            "fast_break_rate": (
                awayStats.get("fastBreakPoints", 0) /
                max(1, awayStats.get("points", 1))
            ),

            # ---------------- TURNOVER PRESSURE ----------------
            "turnover_rate": (
                awayStats.get("turnovers", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "live_ball_turnover_ratio": (
                awayStats.get("steals", 0) /
                max(1, awayStats.get("turnovers", 1))
            ),
            "opp_turnover_pressure": (
                homeStats.get("steals", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- FOUL / FT PRESSURE ----------------
            "foul_pressure_rate": (
                awayStats.get("fouls", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "free_throw_points_ratio": (
                awayStats.get("freeThrowsMade", 0) /
                max(1, awayStats.get("points", 1))
            ),

            # ---------------- DEFENSIVE DISRUPTION ----------------
            "def_disruption_rate": (
                (awayStats.get("blocks", 0) + awayStats.get("steals", 0)) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "opp_shot_disruption": (
                (homeStats.get("blocks", 0) + homeStats.get("steals", 0)) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- SCORING EFFICIENCY ----------------
            "points_per_possession_est": (
                awayStats.get("points", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "assist_ratio": (
                awayStats.get("assists", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- OPPONENT REBOUND DEFENSE ----------------
            "opp_rebound_strength": (
                homeStats.get("totalRebounds", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),

            # ---------------- OPPONENT SHOOTING RESISTANCE ----------------
            "opp_effective_fg_resistance": (
                (
                    homeStats.get("fieldGoalsAttempted", 0)
                    - homeStats.get("fieldGoalsMade", 0)
                ) /
                max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),
        }
    elif sport.name == 'basketball_wncaab':
        sport_features_home = {

            # ---------------- PACE / TEMPO ----------------
            "pace_factor": (
                homeStats.get("estimatedPossessions", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
            "opp_pace_factor": (
                awayStats.get("estimatedPossessions", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
            "pace_ratio": (
                homeStats.get("estimatedPossessions", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- SHOT PROFILE ----------------
            "three_point_rate": (
                homeStats.get("threePointFieldGoalsAttempted", 0) /
                max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),
            "two_point_rate": (
                homeStats.get("twoPointFieldGoalsAttempted", 0) /
                max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),
            "free_throw_rate": (
                homeStats.get("freeThrowsAttempted", 0) /
                max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),

            # ---------------- SHOT QUALITY ----------------
            "shot_creation_efficiency": (
                homeStats.get("assists", 0) /
                max(1, homeStats.get("fieldGoalsMade", 1))
            ),
            "effective_shot_mix_value": (
                (
                    3 * homeStats.get("threePointFieldGoalsMade", 0)
                    + 2 * homeStats.get("twoPointFieldGoalsMade", 0)
                    + homeStats.get("freeThrowsMade", 0)
                ) / max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),

            # ---------------- REBOUND IMPACT ----------------
            "rebound_pressure_ratio": (
                homeStats.get("offensiveRebounds", 0) /
                max(1, awayStats.get("defensiveRebounds", 1))
            ),
            "second_chance_rate": (
                homeStats.get("offensiveRebounds", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- TURNOVER PROFILE ----------------
            "turnover_rate": (
                homeStats.get("turnovers", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "live_ball_turnover_ratio": (
                homeStats.get("steals", 0) /
                max(1, homeStats.get("turnovers", 1))
            ),
            "opp_turnover_pressure": (
                awayStats.get("steals", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- FOUL & FREE THROW IMPACT ----------------
            "free_throw_points_ratio": (
                homeStats.get("freeThrowsMade", 0) /
                max(1, homeStats.get("points", 1))
            ),
            "foul_pressure_rate": (
                homeStats.get("fouls", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- DEFENSIVE DISRUPTION ----------------
            "def_disruption_rate": (
                (homeStats.get("blocks", 0) + homeStats.get("steals", 0)) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "opp_shot_disruption": (
                (awayStats.get("blocks", 0) + awayStats.get("steals", 0)) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- TRANSITION SCORING ----------------
            "fast_break_rate": (
                homeStats.get("fastBreakPoints", 0) /
                max(1, homeStats.get("points", 1))
            ),

            # ---------------- POSSESSION EFFICIENCY ----------------
            "points_per_possession_est": (
                homeStats.get("points", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),
            "assist_ratio": (
                homeStats.get("assists", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- OPPONENT REBOUND DEFENSE ----------------
            "opp_rebound_strength": (
                awayStats.get("totalRebounds", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),

            # ---------------- OPPONENT SHOOTING RESISTANCE ----------------
            "opp_effective_fg_resistance": (
                (
                    awayStats.get("fieldGoalsAttempted", 0)
                    - awayStats.get("fieldGoalsMade", 0)
                ) / max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),
        }
        sport_features_away = {

            # ---------------- PACE / TEMPO ----------------
            "pace_factor": (
                awayStats.get("estimatedPossessions", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
            "opp_pace_factor": (
                homeStats.get("estimatedPossessions", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
            "pace_ratio": (
                awayStats.get("estimatedPossessions", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- SHOT PROFILE ----------------
            "three_point_rate": (
                awayStats.get("threePointFieldGoalsAttempted", 0) /
                max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),
            "two_point_rate": (
                awayStats.get("twoPointFieldGoalsAttempted", 0) /
                max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),
            "free_throw_rate": (
                awayStats.get("freeThrowsAttempted", 0) /
                max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),

            # ---------------- SHOT QUALITY ----------------
            "shot_creation_efficiency": (
                awayStats.get("assists", 0) /
                max(1, awayStats.get("fieldGoalsMade", 1))
            ),
            "effective_shot_mix_value": (
                (
                    3 * awayStats.get("threePointFieldGoalsMade", 0)
                    + 2 * awayStats.get("twoPointFieldGoalsMade", 0)
                    + awayStats.get("freeThrowsMade", 0)
                ) / max(1, awayStats.get("fieldGoalsAttempted", 1))
            ),

            # ---------------- REBOUND IMPACT ----------------
            "rebound_pressure_ratio": (
                awayStats.get("offensiveRebounds", 0) /
                max(1, homeStats.get("defensiveRebounds", 1))
            ),
            "second_chance_rate": (
                awayStats.get("offensiveRebounds", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- TURNOVER PROFILE ----------------
            "turnover_rate": (
                awayStats.get("turnovers", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "live_ball_turnover_ratio": (
                awayStats.get("steals", 0) /
                max(1, awayStats.get("turnovers", 1))
            ),
            "opp_turnover_pressure": (
                homeStats.get("steals", 0) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- FOUL & FREE THROW IMPACT ----------------
            "free_throw_points_ratio": (
                awayStats.get("freeThrowsMade", 0) /
                max(1, awayStats.get("points", 1))
            ),
            "foul_pressure_rate": (
                awayStats.get("fouls", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- DEFENSIVE DISRUPTION ----------------
            "def_disruption_rate": (
                (awayStats.get("blocks", 0) + awayStats.get("steals", 0)) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "opp_shot_disruption": (
                (homeStats.get("blocks", 0) + homeStats.get("steals", 0)) /
                max(1, homeStats.get("estimatedPossessions", 1))
            ),

            # ---------------- TRANSITION SCORING ----------------
            "fast_break_rate": (
                awayStats.get("fastBreakPoints", 0) /
                max(1, awayStats.get("points", 1))
            ),

            # ---------------- POSSESSION EFFICIENCY ----------------
            "points_per_possession_est": (
                awayStats.get("points", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),
            "assist_ratio": (
                awayStats.get("assists", 0) /
                max(1, awayStats.get("estimatedPossessions", 1))
            ),

            # ---------------- OPPONENT REBOUND DEFENSE ----------------
            "opp_rebound_strength": (
                homeStats.get("totalRebounds", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),

            # ---------------- OPPONENT SHOOTING RESISTANCE ----------------
            "opp_effective_fg_resistance": (
                (
                    homeStats.get("fieldGoalsAttempted", 0)
                    - homeStats.get("fieldGoalsMade", 0)
                ) / max(1, homeStats.get("fieldGoalsAttempted", 1))
            ),
        }
    elif sport.name == 'icehockey_nhl':
        sport_features_home = {

            # ---------------- SHOOTING & XG-LIKE PROXIES ----------------
            "shots_per_game": (
                homeStats.get("shotsTotal", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
            "shot_accuracy": (
                homeStats.get("goals", 0) /
                max(1, homeStats.get("shotsTotal", 1))
            ),
            "dangerous_shot_ratio": (
                (homeStats.get("shotsIn1stPeriod", 0) + homeStats.get("shotsIn3rdPeriod", 0)) /
                max(1, homeStats.get("shotsTotal", 1))
            ),  # 1st & 3rd period shots correlate w/ higher danger & offensive momentum

            # ---------------- REBOUND / SECOND-CHANCE OFFENSE ----------------
            "rebound_opportunities": (
                homeStats.get("shotsMissed", 0) /
                max(1, homeStats.get("shotsTotal", 1))
            ),

            # ---------------- GOALTENDING PRESSURE ----------------
            "goalie_shot_load": (
                homeStats.get("shotsAgainst", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
            "goalie_efficiency_gap": (
                homeStats.get("savePct", 0) -
                awayStats.get("savePct", 0)
            ),

            # ---------------- DEFENSIVE DISRUPTION ----------------
            "defense_disruption_rate": (
                (homeStats.get("blockedShots", 0) + homeStats.get("hits", 0)) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
            "takeaway_pressure_rate": (
                homeStats.get("takeaways", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),

            # ---------------- TRANSITION / TURNOVERS ----------------
            "transition_efficiency": (
                homeStats.get("takeaways", 0) /
                max(1, homeStats.get("giveaways", 1))
            ),
            "opp_transition_threat": (
                awayStats.get("takeaways", 0) /
                max(1, awayStats.get("giveaways", 1))
            ),

            # ---------------- SPECIAL TEAMS QUALITY ----------------
            "pp_volume_rate": (
                homeStats.get("powerPlayOpportunities", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
            "pp_conversion_efficiency": (
                homeStats.get("powerPlayGoals", 0) /
                max(1, homeStats.get("powerPlayOpportunities", 1))
            ),
            "pk_vulnerability": (
                homeStats.get("powerPlayGoalsAgainst", 0) /
                max(1, homeStats.get("timesShortHanded", 1))
            ),

            # ---------------- FACE-OFF / POSSESSION CONTROL ----------------
            "faceoff_control_rate": (
                homeStats.get("faceoffsWon", 0) /
                max(1, homeStats.get("faceoffsWon", 0) + homeStats.get("faceoffsLost", 0))
            ),
            "opp_faceoff_strength": (
                awayStats.get("faceoffsWon", 0) /
                max(1, awayStats.get("totalFaceOffs", 1))
            ),

            # ---------------- MOMENTUM / PERIOD WEIGHTING ----------------
            "third_period_scoring_bias": (
                homeStats.get("shotsIn3rdPeriod", 0) /
                max(1, homeStats.get("shotsTotal", 1))
            ),

            # ---------------- PENALTIES & DISCIPLINE ----------------
            "penalty_burden_rate": (
                homeStats.get("penaltyMinutes", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
            "opp_penalty_opportunity": (
                awayStats.get("penalties", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),

            # ---------------- TOTAL OFFENSIVE PRESSURE ----------------
            "offensive_pressure_index": (
                (homeStats.get("shotsTotal", 0) + homeStats.get("takeaways", 0)) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
        }
        sport_features_away = {

            # ---------------- SHOOTING & XG-LIKE PROXIES ----------------
            "shots_per_game": (
                awayStats.get("shotsTotal", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
            "shot_accuracy": (
                awayStats.get("goals", 0) /
                max(1, awayStats.get("shotsTotal", 1))
            ),
            "dangerous_shot_ratio": (
                (awayStats.get("shotsIn1stPeriod", 0) + awayStats.get("shotsIn3rdPeriod", 0)) /
                max(1, awayStats.get("shotsTotal", 1))
            ),

            # ---------------- REBOUND / SECOND-CHANCE OFFENSE ----------------
            "rebound_opportunities": (
                awayStats.get("shotsMissed", 0) /
                max(1, awayStats.get("shotsTotal", 1))
            ),

            # ---------------- GOALTENDING PRESSURE ----------------
            "goalie_shot_load": (
                awayStats.get("shotsAgainst", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
            "goalie_efficiency_gap": (
                awayStats.get("savePct", 0) -
                homeStats.get("savePct", 0)
            ),

            # ---------------- DEFENSIVE DISRUPTION ----------------
            "defense_disruption_rate": (
                (awayStats.get("blockedShots", 0) + awayStats.get("hits", 0)) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
            "takeaway_pressure_rate": (
                awayStats.get("takeaways", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),

            # ---------------- TRANSITION / TURNOVERS ----------------
            "transition_efficiency": (
                awayStats.get("takeaways", 0) /
                max(1, awayStats.get("giveaways", 1))
            ),
            "opp_transition_threat": (
                homeStats.get("takeaways", 0) /
                max(1, homeStats.get("giveaways", 1))
            ),

            # ---------------- SPECIAL TEAMS QUALITY ----------------
            "pp_volume_rate": (
                awayStats.get("powerPlayOpportunities", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
            "pp_conversion_efficiency": (
                awayStats.get("powerPlayGoals", 0) /
                max(1, awayStats.get("powerPlayOpportunities", 1))
            ),
            "pk_vulnerability": (
                awayStats.get("powerPlayGoalsAgainst", 0) /
                max(1, awayStats.get("timesShortHanded", 1))
            ),

            # ---------------- FACE-OFF / POSSESSION CONTROL ----------------
            "faceoff_control_rate": (
                awayStats.get("faceoffsWon", 0) /
                max(1, awayStats.get("faceoffsWon", 0) + awayStats.get("faceoffsLost", 0))
            ),
            "opp_faceoff_strength": (
                homeStats.get("faceoffsWon", 0) /
                max(1, homeStats.get("totalFaceOffs", 1))
            ),

            # ---------------- MOMENTUM / PERIOD WEIGHTING ----------------
            "third_period_scoring_bias": (
                awayStats.get("shotsIn3rdPeriod", 0) /
                max(1, awayStats.get("shotsTotal", 1))
            ),

            # ---------------- PENALTIES & DISCIPLINE ----------------
            "penalty_burden_rate": (
                awayStats.get("penaltyMinutes", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
            "opp_penalty_opportunity": (
                homeStats.get("penalties", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),

            # ---------------- TOTAL OFFENSIVE PRESSURE ----------------
            "offensive_pressure_index": (
                (awayStats.get("shotsTotal", 0) + awayStats.get("takeaways", 0)) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
        }
    elif sport.name == 'baseball_mlb':
        sport_features_home = {

            # ----------------- CONTACT QUALITY / EXPECTED RUN PROXIES -----------------
            "line_drive_ratio": (
                homeStats.get("extraBaseHits", 0) /
                max(1, homeStats.get("hits", 1))
            ),
            "power_ratio": (
                homeStats.get("homeRuns", 0) /
                max(1, homeStats.get("atBats", 1))
            ),
            "contact_quality_index": (
                (homeStats.get("slugAvg", 0) + homeStats.get("isolatedPower", 0)) / 2
            ),

            # ----------------- RUN PRESSURE / BASEPATH THREATS -----------------
            "baserunning_threat_index": (
                (homeStats.get("stolenBases", 0) + homeStats.get("hitByPitch", 0)) /
                max(1, homeStats.get("plateAppearances", 1))
            ),
            "run_pressure_conversion": (
                homeStats.get("RBIs", 0) /
                max(1, homeStats.get("runnersLeftOnBase", 1))
            ),

            # ----------------- CLUTCH / SCORING OPPORTUNITY INDICATORS -----------------
            "scoring_efficiency_rate": (
                homeStats.get("runs", 0) /
                max(1, homeStats.get("totalBases", 1))
            ),
            "late_inning_resilience": (
                homeStats.get("finishes", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),

            # ----------------- STARTING PITCHER QUALITY IMPACT -----------------
            "starter_load_index": (
                homeStats.get("pitchesAsStarter", 0) /
                max(1, homeStats.get("gamesStarted", 1))
            ),
            "starter_efficiency": (
                homeStats.get("pitchesPerStart", 0)
            ),

            # ----------------- BULLPEN FATIGUE / VOLATILITY -----------------
            "bullpen_fatigue_index": (
                homeStats.get("innings", 0) -
                homeStats.get("thirdInnings", 0) / 3
            ),
            "bullpen_leak_rate": (
                homeStats.get("earnedRuns", 0) /
                max(1, homeStats.get("innings", 1))
            ),

            # ----------------- DEFENSIVE SUPPORT FOR RUN PREVENTION -----------------
            "defensive_conversion_rate": (
                homeStats.get("successfulChances", 0) /
                max(1, homeStats.get("totalChances", 1))
            ),
            "range_factor_per_game": (
                homeStats.get("rangeFactor", 0) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),

            # ----------------- PITCHING CONTACT SUPPRESSION -----------------
            "hard_contact_allowed_rate": (
                homeStats.get("opponentTotalBases", 0) /
                max(1, homeStats.get("battersFaced", 1))
            ),
            "pitcher_pressure_index": (
                homeStats.get("pitchesPerInning", 0)
            ),

            # ----------------- WALK / DISCIPLINE ADVANTAGE -----------------
            "discipline_advantage": (
                homeStats.get("walkToStrikeoutRatio", 0) -
                awayStats.get("walkToStrikeoutRatio", 0)
            ),

            # ----------------- LEVERAGE & SCORING MOMENTUM -----------------
            "run_creation_momentum": (
                homeStats.get("runsCreated", 0) /
                max(1, homeStats.get("plateAppearances", 1))
            ),
            "xrun_proxy": (
                (homeStats.get("onBasePct", 0) * homeStats.get("slugAvg", 0))
            ),

            # ----------------- OPPONENT PITCHING VULNERABILITY -----------------
            "opp_pitching_damage_rate": (
                awayStats.get("earnedRuns", 0) /
                max(1, awayStats.get("innings", 1))
            ),
            "opp_hr_vulnerability": (
                awayStats.get("homeRuns", 0) /
                max(1, awayStats.get("battersFaced", 1))
            ),

            # ----------------- TOTAL OFFENSIVE PRESSURE -----------------
            "offensive_pressure_index": (
                (homeStats.get("plateAppearances", 0) + homeStats.get("totalBases", 0)) /
                max(1, homeStats.get("gamesPlayed", 1))
            ),
        }
        sport_features_away = {

            # ----------------- CONTACT QUALITY / EXPECTED RUN PROXIES -----------------
            "line_drive_ratio": (
                awayStats.get("extraBaseHits", 0) /
                max(1, awayStats.get("hits", 1))
            ),
            "power_ratio": (
                awayStats.get("homeRuns", 0) /
                max(1, awayStats.get("atBats", 1))
            ),
            "contact_quality_index": (
                (awayStats.get("slugAvg", 0) + awayStats.get("isolatedPower", 0)) / 2
            ),

            # ----------------- RUN PRESSURE / BASEPATH THREATS -----------------
            "baserunning_threat_index": (
                (awayStats.get("stolenBases", 0) + awayStats.get("hitByPitch", 0)) /
                max(1, awayStats.get("plateAppearances", 1))
            ),
            "run_pressure_conversion": (
                awayStats.get("RBIs", 0) /
                max(1, awayStats.get("runnersLeftOnBase", 1))
            ),

            # ----------------- CLUTCH / SCORING OPPORTUNITY INDICATORS -----------------
            "scoring_efficiency_rate": (
                awayStats.get("runs", 0) /
                max(1, awayStats.get("totalBases", 1))
            ),
            "late_inning_resilience": (
                awayStats.get("finishes", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),

            # ----------------- STARTING PITCHER QUALITY IMPACT -----------------
            "starter_load_index": (
                awayStats.get("pitchesAsStarter", 0) /
                max(1, awayStats.get("gamesStarted", 1))
            ),
            "starter_efficiency": (
                awayStats.get("pitchesPerStart", 0)
            ),

            # ----------------- BULLPEN FATIGUE / VOLATILITY -----------------
            "bullpen_fatigue_index": (
                awayStats.get("innings", 0) -
                awayStats.get("thirdInnings", 0) / 3
            ),
            "bullpen_leak_rate": (
                awayStats.get("earnedRuns", 0) /
                max(1, awayStats.get("innings", 1))
            ),

            # ----------------- DEFENSIVE SUPPORT FOR RUN PREVENTION -----------------
            "defensive_conversion_rate": (
                awayStats.get("successfulChances", 0) /
                max(1, awayStats.get("totalChances", 1))
            ),
            "range_factor_per_game": (
                awayStats.get("rangeFactor", 0) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),

            # ----------------- PITCHING CONTACT SUPPRESSION -----------------
            "hard_contact_allowed_rate": (
                awayStats.get("opponentTotalBases", 0) /
                max(1, awayStats.get("battersFaced", 1))
            ),
            "pitcher_pressure_index": (
                awayStats.get("pitchesPerInning", 0)
            ),

            # ----------------- WALK / DISCIPLINE ADVANTAGE -----------------
            "discipline_advantage": (
                awayStats.get("walkToStrikeoutRatio", 0) -
                homeStats.get("walkToStrikeoutRatio", 0)
            ),

            # ----------------- LEVERAGE & SCORING MOMENTUM -----------------
            "run_creation_momentum": (
                awayStats.get("runsCreated", 0) /
                max(1, awayStats.get("plateAppearances", 1))
            ),
            "xrun_proxy": (
                (awayStats.get("onBasePct", 0) * awayStats.get("slugAvg", 0))
            ),

            # ----------------- OPPONENT PITCHING VULNERABILITY -----------------
            "opp_pitching_damage_rate": (
                homeStats.get("earnedRuns", 0) /
                max(1, homeStats.get("innings", 1))
            ),
            "opp_hr_vulnerability": (
                homeStats.get("homeRuns", 0) /
                max(1, homeStats.get("battersFaced", 1))
            ),

            # ----------------- TOTAL OFFENSIVE PRESSURE -----------------
            "offensive_pressure_index": (
                (awayStats.get("plateAppearances", 0) + awayStats.get("totalBases", 0)) /
                max(1, awayStats.get("gamesPlayed", 1))
            ),
        }


    # ---- Existing scoring history ----
    home_hist = team_history.get(home_id, [])
    away_hist = team_history.get(away_id, [])
    home_home_hist = team_home_history.get(home_id, [])
    away_away_hist = team_away_history.get(away_id, [])

    # Helper rolling average
    def ra(hist, n): return np.mean(hist[-n:]) if hist else 0

    # Rolling averages, std, trends
    home_avg_last5 = ra(home_hist, 5)
    home_avg_last10 = ra(home_hist, 10)
    away_avg_last5 = ra(away_hist, 5)
    away_avg_last10 = ra(away_hist, 10)
    home_avg_last5_home = ra(home_home_hist, 5)
    home_avg_last10_home = ra(home_home_hist, 10)
    away_avg_last5_away = ra(away_away_hist, 5)
    away_avg_last10_away = ra(away_away_hist, 10)
    home_std_last5 = np.std(home_hist[-5:]) if len(home_hist) >= 2 else 0
    away_std_last5 = np.std(away_hist[-5:]) if len(away_hist) >= 2 else 0
    home_trend = np.polyfit(range(len(home_hist[-5:])), home_hist[-5:], 1)[0] if len(home_hist[-5:]) >= 2 else 0
    away_trend = np.polyfit(range(len(away_hist[-5:])), away_hist[-5:], 1)[0] if len(away_hist[-5:]) >= 2 else 0
    home_score_diff_last = home_hist[-1]-home_hist[-2] if len(home_hist)>=2 else 0
    away_score_diff_last = away_hist[-1]-away_hist[-2] if len(away_hist)>=2 else 0
    home_avg_last3 = ra(home_hist, 3)
    away_avg_last3 = ra(away_hist, 3)
    home_slope_3_vs_10 = home_avg_last3 - home_avg_last10
    away_slope_3_vs_10 = away_avg_last3 - away_avg_last10
    home_q75 = np.percentile(home_hist[-10:], 75) if home_hist else 0
    home_q25 = np.percentile(home_hist[-10:], 25) if home_hist else 0
    away_q75 = np.percentile(away_hist[-10:], 75) if away_hist else 0
    away_q25 = np.percentile(away_hist[-10:], 25) if away_hist else 0
    home_streak = calc_streak(home_hist)
    away_streak = calc_streak(away_hist)
    home_rest = rest_days(home_id, game, last_games_info)
    away_rest = rest_days(away_id, game, last_games_info)
    vs_opp_home = get_vs_opp_features(home_id, away_id, team_vs_team_history)
    vs_opp_away = get_vs_opp_features(away_id, home_id, team_vs_team_history)

    # ---- Build features ----
    def make_features(perspective):
        if perspective=="home":
            t_stats, o_stats = homeStats, awayStats
            t_id, o_id = home_id, away_id
            t_avg_last5, t_avg_last10 = home_avg_last5, home_avg_last10
            t_avg_last5_home, t_avg_last10_home = home_avg_last5_home, home_avg_last10_home
            t_std_last5, t_trend = home_std_last5, home_trend
            t_diff_last, t_avg_last3 = home_score_diff_last, home_avg_last3
            t_slope_3_vs_10, t_q75, t_q25 = home_slope_3_vs_10, home_q75, home_q25
            t_streak, t_rest = home_streak, home_rest
            o_avg_last5, o_avg_last10 = away_avg_last5, away_avg_last10
            o_avg_last5_away, o_avg_last10_away = away_avg_last5_away, away_avg_last10_away
            o_std_last5, o_trend = away_std_last5, away_trend
            o_diff_last, o_avg_last3 = away_score_diff_last, away_avg_last3
            o_slope_3_vs_10, o_q75, o_q25 = away_slope_3_vs_10, away_q75, away_q25
            o_streak, o_rest = away_streak, away_rest
            vs_opp = vs_opp_home
            elo_team, elo_opp = pre_elo_home, pre_elo_away
            sos_team, sos_team_last5 = sos_home, sos_home_last5
            sos_opp, sos_opp_last5 = sos_away, sos_away_last5
            srs_team, srs_team_last5 = srs_home, srs_home_last5
            srs_opp, srs_opp_last5 = srs_away, srs_away_last5
        else:
            t_stats, o_stats = awayStats, homeStats
            t_id, o_id = away_id, home_id
            t_avg_last5, t_avg_last10 = away_avg_last5, away_avg_last10
            t_avg_last5_home, t_avg_last10_home = away_avg_last5_away, away_avg_last10_away
            t_std_last5, t_trend = away_std_last5, away_trend
            t_diff_last, t_avg_last3 = away_score_diff_last, away_avg_last3
            t_slope_3_vs_10, t_q75, t_q25 = away_slope_3_vs_10, away_q75, away_q25
            t_streak, t_rest = away_streak, away_rest
            o_avg_last5, o_avg_last10 = home_avg_last5, home_avg_last10
            o_avg_last5_away, o_avg_last10_away = home_avg_last5_home, home_avg_last10_home
            o_std_last5, o_trend = home_std_last5, home_trend
            o_diff_last, o_avg_last3 = home_score_diff_last, home_avg_last3
            o_slope_3_vs_10, o_q75, o_q25 = home_slope_3_vs_10, home_q75, home_q25
            o_streak, o_rest = home_streak, home_rest
            vs_opp = vs_opp_away
            elo_team, elo_opp = pre_elo_away, pre_elo_home
            sos_team, sos_team_last5 = sos_away, sos_away_last5
            sos_opp, sos_opp_last5 = sos_home, sos_home_last5
            srs_team, srs_team_last5 = srs_away, srs_away_last5
            srs_opp, srs_opp_last5 = srs_home, srs_home_last5

        sport_features = sport_features_home if perspective == "home" else sport_features_away

        features = {
            **{f"team_{k}": to_number(v) for k,v in t_stats.items()},
            **{f"opponent_{k}": to_number(v) for k,v in o_stats.items()},
            **{f"diff_{k}": to_number(t_stats[k])-to_number(o_stats[k]) for k in required_keys},
            "is_home": 1 if perspective=="home" else 0,
            "avg_diff": t_avg_last5 - o_avg_last5,
            "home_avg_last5": t_avg_last5,
            "home_avg_last10": t_avg_last10,
            "home_avg_last5_home": t_avg_last5_home,
            "home_avg_last10_home": t_avg_last10_home,
            "home_score_std_last5": t_std_last5,
            "home_score_trend": t_trend,
            "home_score_diff_last": t_diff_last,
            "home_avg_last3": t_avg_last3,
            "home_score_q75_last10": t_q75,
            "home_score_q25_last10": t_q25,
            "home_slope_3_vs_10": t_slope_3_vs_10,
            "home_streak": t_streak,
            "home_rest": t_rest,
            "away_avg_last5": o_avg_last5,
            "away_avg_last10": o_avg_last10,
            "away_avg_last5_away": o_avg_last5_away,
            "away_avg_last10_away": o_avg_last10_away,
            "away_score_std_last5": o_std_last5,
            "away_score_trend": o_trend,
            "away_score_diff_last": o_diff_last,
            "away_avg_last3": o_avg_last3,
            "away_score_q75_last10": o_q75,
            "away_score_q25_last10": o_q25,
            "away_slope_3_vs_10": o_slope_3_vs_10,
            "away_streak": o_streak,
            "away_rest": o_rest,
            **sport_features,
            # ----- NEW FEATURES -----
            "elo_pre": elo_team,
            "opp_elo_pre": elo_opp,
            "elo_last5_slope": (np.polyfit(range(len(team_elo_history[t_id][-5:])), team_elo_history[t_id][-5:], 1)[0] if len(team_elo_history[t_id][-5:])>=2 else 0),
            "elo_vol_last5": np.std(team_elo_history[t_id][-5:]) if len(team_elo_history[t_id][-5:])>=2 else 0,
            "team_sos": sos_team,
            "team_sos_last5": sos_team_last5,
            "opp_sos": sos_opp,
            "opp_sos_last5": sos_opp_last5,
            "srs": srs_team,
            "srs_last5": srs_team_last5,
            "opp_srs": srs_opp,
            "opp_srs_last5": srs_opp_last5,
            **vs_opp,
        }
        return features

    home_features = make_features("home")
    away_features = make_features("away")

    return [home_features, away_features]