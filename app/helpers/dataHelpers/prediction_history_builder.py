from collections import defaultdict
import math

def prediction_history_builder(game_data, sport):
    """
    Builds historical state for feature extraction, including Elo and SOS.
    """


    BASE_ELO = 1500
    HOME_ADV = 60

    team_history = defaultdict(list)
    team_home_history = defaultdict(list)
    team_away_history = defaultdict(list)
    last_games_info = defaultdict(list)
    team_vs_team_history = defaultdict(lambda: defaultdict(list))

    team_elo = {}
    team_elo_history = {}
    team_sos_components = {}
    last_seen_season_month = {}

    for game in game_data:
        if game.homeStats is None or game.awayStats is None or game.homeScore is None or game.awayScore is None:
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

        pre_elo_home = team_elo.get(home_id, BASE_ELO)
        pre_elo_away = team_elo.get(away_id, BASE_ELO)
        team_elo.setdefault(home_id, pre_elo_home)
        team_elo.setdefault(away_id, pre_elo_away)
        team_elo_history.setdefault(home_id, [])
        team_elo_history.setdefault(away_id, [])
        team_sos_components.setdefault(home_id, [])
        team_sos_components.setdefault(away_id, [])

        # Update SOS components
        team_sos_components[home_id].append(pre_elo_away)
        team_sos_components[away_id].append(pre_elo_home)

        # ---- Update Elo ----
        point_diff = game.homeScore - game.awayScore
        abs_diff = abs(point_diff)
        exp_home = 1 / (1 + 10 ** (-(pre_elo_home + HOME_ADV - pre_elo_away) / 400))
        exp_away = 1 - exp_home
        actual_home = 1 if point_diff>0 else 0
        actual_away = 1 - actual_home
        mov_mult = math.log(abs_diff+1) * (2.2 / ((pre_elo_home-pre_elo_away)*0.001 + 2.2))
        team_elo[home_id] += 25 * mov_mult * (actual_home - exp_home)
        team_elo[away_id] += 25 * mov_mult * (actual_away - exp_away)

        team_elo_history[home_id].append(team_elo[home_id])
        team_elo_history[away_id].append(team_elo[away_id])

        # ---- Update score histories ----
        team_history[home_id].append(game.homeScore)
        team_history[away_id].append(game.awayScore)
        team_home_history[home_id].append(game.homeScore)
        team_away_history[away_id].append(game.awayScore)
        last_games_info[home_id].append((game.commence_time, game.homeScore, game.awayScore))
        last_games_info[away_id].append((game.commence_time, game.awayScore, game.homeScore))
        team_vs_team_history[home_id][away_id].append({"date": game.commence_time, "team_score": game.homeScore, "opp_score": game.awayScore})
        team_vs_team_history[away_id][home_id].append({"date": game.commence_time, "team_score": game.awayScore, "opp_score": game.homeScore})

    return (dict(team_history), dict(last_games_info),
            dict(team_home_history), dict(team_away_history),
            dict(team_vs_team_history), dict(team_elo), dict(team_elo_history),
            dict(team_sos_components), dict(last_seen_season_month))
