import asyncio
import pandas as pd
import logging
import numpy as np
from app.celery_app.celery import celery
from app.helpers.dataHelpers.db_getters.get_sports_sync import get_sports_sync
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
from app.helpers.dataHelpers.db_setters.save_value_bet_segment_async import save_value_bet_segment
logger = logging.getLogger(__name__)

def get_best_odds_for_game(game, market_key):
    """
    Returns the best available outcome across all sportsbooks
    for the given market_key (e.g., 'h2h', 'spreads', 'totals').

    Best = highest price:
        - For favorites (negative odds): closest to zero
        - For underdogs (positive odds): largest positive
    """
    best_outcome = None

    if not getattr(game, "bookmakers", None):
        return None

    for bookmaker in game.bookmakers:
        markets = getattr(bookmaker, "markets", [])
        market = next((m for m in markets if m.key == market_key), None)
        if not market:
            continue

        for outcome in getattr(market, "outcomes", []):
            predictedWinner = ''
            if game.predictedWinner == 'home':
                predictedWinner = game.homeTeamDetails.espnDisplayName
            elif game.predictedWinner == 'away':
                predictedWinner = game.awayTeamDetails.espnDisplayName
            # American odds — higher number = better price no matter +/- sign
            if best_outcome is None or outcome.price > best_outcome.price and outcome.name == predictedWinner:
                best_outcome = outcome

    return best_outcome

def compute_segment_variance(segment_games):
    edges = []

    for entry in segment_games:
        game = entry["game"]
        outcome = entry["outcome"]

        predicted_prob = getattr(game, "predictionConfidence", None)
        implied_prob = outcome["implied_prob"]

        if predicted_prob is not None and implied_prob is not None:
            edges.append(predicted_prob - implied_prob)

    return float(np.var(edges)) if edges else 0.0


def compute_segment_reliability(segment_variance, min_weight=0.1, max_weight=1.0):
    """
    Converts variance to a reliability weight between min_weight and max_weight.
    Higher variance → lower reliability.
    """
    if segment_variance == 0:
        return max_weight

    weight = 1.0 / (1.0 + segment_variance)  # simple inverse scaling
    weight = max(min_weight, min(weight, max_weight))
    return weight

def compute_segment_threshold(segment_games, num_bins=50):

    value_scores = []

    for entry in segment_games:
        game = entry["game"]
        outcome = entry["outcome"]

        predicted_prob = getattr(game, "predictionConfidence", None)
        implied_prob   = outcome.get("implied_prob")
        price          = outcome.get("price")

        if predicted_prob is None or implied_prob is None or price is None:
            continue

        edge = predicted_prob - implied_prob
        value_scores.append(edge)

    if not value_scores:
        return 0.0

    thresholds = np.linspace(min(value_scores), max(value_scores), num_bins)
    best_threshold = thresholds[0]
    best_profit = -np.inf

    for t in thresholds:
        profit = sum(
            (o["price"] / 100 if o["price"] > 0 else -100 / o["price"])
            for entry in segment_games
            for o in [entry["outcome"]]
            if getattr(entry["game"], "predictionConfidence", 0) - o["implied_prob"] > t
        )
        if profit > best_profit:
            best_profit = profit
            best_threshold = t

    return float(best_threshold)



async def value_segment_search(sport, sport_games):
    AsyncSessionLocal, engine = get_async_session_factory()
    SEGMENTS = [

        # -----------------------------
        # LOCATION
        # -----------------------------
        {
            "key": "home",
            "description": "Home team bets only",
            "condition": lambda game, outcome: outcome["team"] == game.homeTeam,
            "js_condition": "({ game, outcome }) => outcome.team === game.homeTeam"
        },
        {
            "key": "away",
            "description": "Away team bets only",
            "condition": lambda game, outcome: outcome["team"] == game.awayTeam,
            "js_condition": "({ game, outcome }) => outcome.team === game.awayTeam"
        },
        # -----------------------------
        # ODDS-BASED TIERS
        # -----------------------------
        {
            "key": "favorite",
            "description": "Team with implied probability > 50%",
            "condition": lambda game, outcome: outcome['implied_prob'] > 0.50,
            "js_condition": "({ game, outcome }) => outcome.implied_prob > 0.50"
        },
        {
            "key": "dog",
            "description": "Team with implied probability < 50%",
            "condition": lambda game, outcome: outcome['implied_prob'] < 0.50,
            "js_condition": "({ game, outcome }) => outcome.implied_prob < 0.50"
        },
        # Odds buckets
        {
            "key": "big_favorite",
            "description": "Heavy fav -200 or lower",
            "condition": lambda game, outcome: outcome['price'] <= -200,
            "js_condition": "({ game, outcome }) => outcome.price <= -200"
        },
        {
            "key": "medium_favorite",
            "description": "-120 to -199 favorites",
            "condition": lambda game, outcome: -199 <= outcome['price'] <= -120,
            "js_condition": "({ game, outcome }) => outcome.price >= -199 && outcome.price <= -120"
        },
        {
            "key": "small_favorite",
            "description": "-101 to -119 favorites",
            "condition": lambda game, outcome: -119 <= outcome['price'] <= -101,
            "js_condition": "({ game, outcome }) => outcome.price >= -119 && outcome.price <= -101"
        },

        {
            "key": "small_dog",
            "description": "+100 to +149",
            "condition": lambda game, outcome: 100 <= outcome['price'] <= 149,
            "js_condition": "({ game, outcome }) => outcome.price >= 100 && outcome.price <= 149"
        },
        {
            "key": "medium_dog",
            "description": "+150 to +249",
            "condition": lambda game, outcome: 150 <= outcome['price'] <= 249,
            "js_condition": "({ game, outcome }) => outcome.price >= 150 && outcome.price <= 249"
        },
        {
            "key": "big_dog",
            "description": "Longshots +250 or above",
            "condition": lambda game, outcome: outcome['price'] >= 250,
            "js_condition": "({ game, outcome }) => outcome.price >= 250"
        },
        # -----------------------------
        # SPREAD SEGMENTS
        # -----------------------------
        {
            "key": "large_spread_fav",
            "description": "Favs with spreads -7 or more",
            "condition": lambda game, outcome: outcome.get('point') is not None and outcome['point'] <= -7,
            "js_condition": "({ game, outcome }) => outcome.point !== null && outcome.point <= -7"
        },
        {
            "key": "small_spread_fav",
            "description": "-1 to -6.5 favorites",
            "condition": lambda game, outcome: outcome.get('point') is not None and -6.5 <= outcome['point'] <= -1,
            "js_condition": "({ game, outcome }) => outcome.point !== null && outcome.point >= -6.5 && outcome.point <= -1"
        },
        {
            "key": "small_spread_dog",
            "description": "+1 to +6.5 dogs",
            "condition": lambda game, outcome: outcome.get('point') is not None and 1 <= outcome['point'] <= 6.5,
            "js_condition": "({ game, outcome }) => outcome.point !== null && outcome.point >= 1 && outcome.point <= 6.5"
        },
        {
            "key": "large_spread_dog",
            "description": "+7 or larger dogs",
            "condition": lambda game, outcome: outcome.get('point') is not None and outcome['point'] >= 7,
            "js_condition": "({ game, outcome }) => outcome.point !== null && outcome.point >= 7"
        },
        # -----------------------------
        # TOTALS SEGMENTS
        # -----------------------------
        # {
        #     "key": "high_total",
        #     "description": "Above-median total for this sport",
        #     "condition": lambda game, outcome: game.total_points is not None and game.total_points > game.sport_median_total
        # },
        # {
        #     "key": "low_total",
        #     "description": "Below-median total for this sport",
        #     "condition": lambda game, outcome: game.total_points is not None and game.total_points < game.sport_median_total
        # }

    ]

    for segment in SEGMENTS:

        segment_games = []   # ← THIS is what you were asking about

        for game in sport_games:
            outcome = get_best_odds_for_game(game, "h2h")
            if outcome is None:
                continue
            outcome_dict = {
                "price": outcome.price,
                "team": outcome.teamId,
                "implied_prob": outcome.impliedProbability,
                "point": getattr(outcome, "point", None)
            }
            # Evaluate segment condition
            if segment["condition"](game, outcome_dict):
                segment_games.append({
                    "game": game,
                    "outcome": outcome_dict
                })

        # Determine minimum sample size per sport
        min_samples = 15 if sport.name == "americanfootball_nfl" else 30

        # Apply the check
        if len(segment_games) < min_samples:
            # logger.info(
            #     f"{sport.name} {segment['key']} NOT ENOUGH SAMPLES "
            #     f"{len(segment_games)} (min required {min_samples})"
            # )
            continue

        # Compute metrics ONLY for this segment
        seg_variance      = compute_segment_variance(segment_games)
        seg_reliability   = compute_segment_reliability(seg_variance)
        seg_threshold     = compute_segment_threshold(segment_games)

        payload={
            'sport': sport.id,
            'segmentKey': segment['key'],
            'segmentJsCondition': segment['js_condition'],
            'segmentVariance': seg_variance,
            'segmentReliability': seg_reliability,
            'segmentThreshold': seg_threshold,
            'sampleSize': len(segment_games),
        }

        # Save to DB
        await save_value_bet_segment(
            AsyncSessionLocal,
            payload
        )
