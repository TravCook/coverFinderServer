from collections import defaultdict
import numpy as np
from statistics import mean, stdev
import logging
from datetime import timezone
import pytz
import pandas as pd
from math import log, exp
logger = logging.getLogger(__name__)

PACIFIC = pytz.timezone("US/Pacific")
def render_results_row(result):
    logger.info(
    f"THRESHOLD: {result['threshold']:.2f} | "
    f"{result['num_bets']:.2f} | "
    f"WINRATE: {result['winrate']:.2f} | "
    f"PROFIT: {result['total_profit']:.2f} | "
    f"ROI: {result['roi']:.2f} | "
    f"PEAK: {result['peak_bankroll']:.2f} | "
    f"AVG_DD: {result['avg_drawdown']:.2%} | "
    f"PPB: {result['profit_per_bet']:.3f} | "
    f"STD: {result['return_std']:.3f} | "
    f"sem={result['sem']:.3f} | conf={result['confidence']:.2f} | tanh={np.tanh(result['confidence']):.2f}"
    f"COMBINED SCORE: {result['combined_score']:.2f} | "
)
def us_odds_payout(odds: float, stake: float) -> float:
    """
    Calculate payout from US odds.

    Parameters:
        odds (float): US odds, e.g., +150 or -200
        stake (float): Amount wagered

    Returns:
        float: Total payout (profit + original stake)
    """
    if odds > 0:
        # Positive odds: profit = stake * (odds / 100)
        profit = stake * (odds / 100)
    else:
        # Negative odds: profit = stake * (100 / abs(odds))
        profit = stake * (100 / abs(odds))

    return stake + profit
def us_to_decimal(odds: float) -> float:
    """
    Convert US odds to decimal odds.

    Args:
        odds (float): US odds. Positive for underdog, negative for favorite.

    Returns:
        float: Decimal odds
    """
    if odds > 0:
        return 1 + (odds / 100)
    else:
        return 1 + (100 / abs(odds))


def extract_features(games):
    games_sorted = sorted(games, key=lambda g: g.commence_time)

    rows = []
    recent_spreads = defaultdict(list)
    recent_win_probs = defaultdict(list)
    recent_accuracy = defaultdict(list)

    def safe_mean(x): return float(mean(x)) if x else 0.0
    def safe_std(x): return float(stdev(x)) if len(x) > 1 else 0.0

    for i, game in enumerate(games_sorted):
        best_h2h_outcome = None
        best_spread_outcome = None

        for bookmaker in game.bookmakers:
            h2h = next((m for m in bookmaker.markets if m.key == "h2h"), None)
            spreads = next((m for m in bookmaker.markets if m.key == "spreads"), None)
            if not h2h or not spreads:
                continue

            predicted_name = (
                game.homeTeamDetails.espnDisplayName
                if game.predictedWinner == "home"
                else game.awayTeamDetails.espnDisplayName
            )

            for o in h2h.outcomes:
                if o.name == predicted_name:
                    if best_h2h_outcome is None or o.price > best_h2h_outcome.price:
                        best_h2h_outcome = o

            for o in spreads.outcomes:
                if o.name == predicted_name:
                    if best_spread_outcome is None or o.price > best_spread_outcome.price:
                        best_spread_outcome = o

        if not best_h2h_outcome:
            continue

        home = game.homeTeamDetails.espnDisplayName
        away = game.awayTeamDetails.espnDisplayName
        day_games = [g for g in games_sorted if g.commence_time.date() == game.commence_time.date()]

        # --- Core projections ---
        projected_spread = game.predictedHomeScore - game.predictedAwayScore
        abs_projected_spread = abs(projected_spread)
        model_confidence = game.predictionConfidence
        picked_home = int(game.predictedWinner == "home")

        decimal_odds = us_to_decimal(best_h2h_outcome.price)
        implied_prob = best_h2h_outcome.impliedProbability
        edge = model_confidence - implied_prob

        ev = (model_confidence * (decimal_odds - 1)) - (1 - model_confidence)

        # Kelly fraction (raw, unclipped)
        b = decimal_odds - 1
        q = 1 - model_confidence
        raw_kelly = ((b * model_confidence) - q) / b if b > 0 else 0

        # --- Rolling history ---
        home_spreads = recent_spreads[home][-10:]
        away_spreads = recent_spreads[away][-10:]

        home_conf = recent_win_probs[home][-10:]
        away_conf = recent_win_probs[away][-10:]

        home_err = recent_accuracy[home][-10:]
        away_err = recent_accuracy[away][-10:]


        # --- Disagreement metrics ---
        home_disagreement = abs(projected_spread - safe_mean(home_spreads))
        away_disagreement = abs(-projected_spread - safe_mean(away_spreads))
        total_disagreement = home_disagreement + away_disagreement

        # --- Cross-sectional (day-level) ---
        day_abs_spreads = [abs(g.predictedHomeScore - g.predictedAwayScore) for g in day_games]
        spread_rank_today = sum(abs_projected_spread >= s for s in day_abs_spreads) / len(day_abs_spreads)

        day_confidences = [g.predictionConfidence for g in day_games]
        confidence_rank_today = sum(model_confidence >= c for c in day_confidences) / len(day_confidences)

        # --- Normalizations ---
        spread_z = (
            (abs_projected_spread - safe_mean(day_abs_spreads)) /
            (safe_std(day_abs_spreads) + 1e-6)
        )

        confidence_z = (
            (model_confidence - safe_mean(day_confidences)) /
            (safe_std(day_confidences) + 1e-6)
        )

        # --- Interaction terms ---
        spread_x_conf = projected_spread * model_confidence
        conf_x_edge = model_confidence * edge
        kelly_x_edge = raw_kelly * edge
        conf_x_disagreement = model_confidence * total_disagreement
        ev_x_conf = ev * model_confidence

        # --- Risk proxies ---
        confidence_volatility = safe_std(home_conf + away_conf)
        recent_accuracy_mean = safe_mean(home_err + away_err)
        recent_accuracy_std = safe_std(home_err + away_err)

        # --- Final feature vector ---
        features = {
            # Core
            "model_confidence": model_confidence,
            "implied_probability": implied_prob,
            "edge": edge,
            "ev": ev,
            "raw_kelly": raw_kelly,

            # Spread
            "projected_spread": projected_spread,
            "abs_projected_spread": abs_projected_spread,
            "spread_z": spread_z,
            "spread_rank_today": spread_rank_today,

            # Confidence
            "confidence_z": confidence_z,
            "confidence_rank_today": confidence_rank_today,
            "confidence_volatility": confidence_volatility,

            # History
            "home_recent_spread_mean": safe_mean(home_spreads),
            "away_recent_spread_mean": safe_mean(away_spreads),
            "home_recent_conf_mean": safe_mean(home_conf),
            "away_recent_conf_mean": safe_mean(away_conf),
            "recent_accuracy_mean": recent_accuracy_mean,
            "recent_accuracy_std": recent_accuracy_std,

            # Disagreement
            "home_disagreement": home_disagreement,
            "away_disagreement": away_disagreement,
            "total_disagreement": total_disagreement,

            # Interactions
            "spread_x_conf": spread_x_conf,
            "conf_x_edge": conf_x_edge,
            "kelly_x_edge": kelly_x_edge,
            "conf_x_disagreement": conf_x_disagreement,
            "ev_x_conf": ev_x_conf,

            # Flags
            "picked_home": picked_home,
        }

        rows.append({
            "game_id": game.id,
            "game_obj": game,   # keep the full game object
            "features": features,
            "label": int(game.predictionCorrect) if game.complete else None,
            "complete": game.complete,
            "odds": us_to_decimal(best_h2h_outcome.price),
        })


        if game.complete:
            # Update history for next games
            recent_spreads[home].append(game.predictedHomeScore - game.predictedAwayScore)
            recent_spreads[away].append(game.predictedAwayScore - game.predictedHomeScore)

            if game.predictedWinner == "home":
                p_home = game.predictionConfidence
                recent_win_probs[home].append(p_home)
            else:
                p_away = game.predictionConfidence
                recent_win_probs[away].append(p_away)

            if game.predictedWinner == "home":
                recent_accuracy[home].append(int(game.predictionCorrect))
                recent_accuracy[away].append(1 - int(game.predictionCorrect))
            else:
                recent_accuracy[away].append(int(game.predictionCorrect))
                recent_accuracy[home].append(1 - int(game.predictionCorrect))

    
    return rows

def value_extract_features_single(game, games_same_day, history):
    """
    Extract value-model features for a single game using pre-built history.
    Does NOT mutate history.

    Parameters:
    - game: Game object to score
    - games_same_day: list of games on the same date (for cross-sectional ranks)
    - history: dict with keys spreads, confidences, errors, ev

    Returns:
    - dict with feature names -> values
    """

    def safe_mean(x): return float(mean(x)) if x else 0.0
    def safe_std(x): return float(stdev(x)) if len(x) > 1 else 0.0

    # ----------------------------------------
    # Find best odds
    # ----------------------------------------
    best_h2h_outcome = None
    best_spread_outcome = None

    for bookmaker in game.bookmakers:
        h2h = next((m for m in bookmaker.markets if m.key == "h2h"), None)
        spreads = next((m for m in bookmaker.markets if m.key == "spreads"), None)
        if not h2h or not spreads:
            continue

        predicted_name = (
            game.homeTeamDetails.espnDisplayName
            if game.predictedWinner == "home"
            else game.awayTeamDetails.espnDisplayName
        )

        for o in h2h.outcomes:
            if o.name == predicted_name:
                if best_h2h_outcome is None or o.price > best_h2h_outcome.price:
                    best_h2h_outcome = o

        for o in spreads.outcomes:
            if o.name == predicted_name:
                if best_spread_outcome is None or o.price > best_spread_outcome.price:
                    best_spread_outcome = o

    if not best_h2h_outcome:
        return None

    # ----------------------------------------
    # Core identifiers
    # ----------------------------------------
    home = game.homeTeamDetails.espnDisplayName
    away = game.awayTeamDetails.espnDisplayName

    # ----------------------------------------
    # Core projections
    # ----------------------------------------
    projected_spread = game.predictedHomeScore - game.predictedAwayScore
    abs_projected_spread = abs(projected_spread)
    model_confidence = game.predictionConfidence
    picked_home = int(game.predictedWinner == "home")

    decimal_odds = us_to_decimal(best_h2h_outcome.price)
    implied_prob = best_h2h_outcome.impliedProbability
    edge = model_confidence - implied_prob

    ev = (model_confidence * (decimal_odds - 1)) - (1 - model_confidence)

    # Kelly (raw)
    b = decimal_odds - 1
    q = 1 - model_confidence
    raw_kelly = ((b * model_confidence) - q) / b if b > 0 else 0.0

    # ----------------------------------------
    # History (read-only)
    # ----------------------------------------
    home_spreads = history["spreads"][home][-10:]
    away_spreads = history["spreads"][away][-10:]

    home_conf = history["confidences"][home][-10:]
    away_conf = history["confidences"][away][-10:]

    home_err = history["errors"][home][-10:]
    away_err = history["errors"][away][-10:]

    # ----------------------------------------
    # Disagreement
    # ----------------------------------------
    home_disagreement = abs(projected_spread - safe_mean(home_spreads))
    away_disagreement = abs(-projected_spread - safe_mean(away_spreads))
    total_disagreement = home_disagreement + away_disagreement

    # ----------------------------------------
    # Cross-sectional (same day)
    # ----------------------------------------
    day_abs_spreads = [
        abs(g.predictedHomeScore - g.predictedAwayScore)
        for g in games_same_day
    ]
    spread_rank_today = (
        sum(abs_projected_spread >= s for s in day_abs_spreads)
        / len(day_abs_spreads)
        if day_abs_spreads else 0.0
    )

    day_confidences = [g.predictionConfidence for g in games_same_day]
    confidence_rank_today = (
        sum(model_confidence >= c for c in day_confidences)
        / len(day_confidences)
        if day_confidences else 0.0
    )

    # ----------------------------------------
    # Normalizations
    # ----------------------------------------
    spread_z = (
        (abs_projected_spread - safe_mean(day_abs_spreads))
        / (safe_std(day_abs_spreads) + 1e-6)
    )

    confidence_z = (
        (model_confidence - safe_mean(day_confidences))
        / (safe_std(day_confidences) + 1e-6)
    )

    # ----------------------------------------
    # Interactions
    # ----------------------------------------
    spread_x_conf = projected_spread * model_confidence
    conf_x_edge = model_confidence * edge
    kelly_x_edge = raw_kelly * edge
    conf_x_disagreement = model_confidence * total_disagreement
    ev_x_conf = ev * model_confidence

    # ----------------------------------------
    # Risk proxies
    # ----------------------------------------
    confidence_volatility = safe_std(home_conf + away_conf)
    recent_accuracy_mean = safe_mean(home_err + away_err)
    recent_accuracy_std = safe_std(home_err + away_err)

    # ----------------------------------------
    # Final feature vector (IDENTICAL KEYS)
    # ----------------------------------------
    
    return {
        # Core
        "model_confidence": model_confidence,
        "implied_probability": implied_prob,
        "edge": edge,
        "ev": ev,
        "raw_kelly": raw_kelly,

        # Spread
        "projected_spread": projected_spread,
        "abs_projected_spread": abs_projected_spread,
        "spread_z": spread_z,
        "spread_rank_today": spread_rank_today,

        # Confidence
        "confidence_z": confidence_z,
        "confidence_rank_today": confidence_rank_today,
        "confidence_volatility": confidence_volatility,

        # History
        "home_recent_spread_mean": safe_mean(home_spreads),
        "away_recent_spread_mean": safe_mean(away_spreads),
        "home_recent_conf_mean": safe_mean(home_conf),
        "away_recent_conf_mean": safe_mean(away_conf),
        "recent_accuracy_mean": recent_accuracy_mean,
        "recent_accuracy_std": recent_accuracy_std,
        # Disagreement
        "home_disagreement": home_disagreement,
        "away_disagreement": away_disagreement,
        "total_disagreement": total_disagreement,

        # Interactions
        "spread_x_conf": spread_x_conf,
        "conf_x_edge": conf_x_edge,
        "kelly_x_edge": kelly_x_edge,
        "conf_x_disagreement": conf_x_disagreement,
        "ev_x_conf": ev_x_conf,

        # Flags
        "picked_home": picked_home,
    }

def value_history_builder(games):
    """
    Build value-model rolling history exactly as extract_features does.

    Parameters:
    - games: list of Game objects (completed + incomplete allowed)

    Returns:
    - history dict with spreads, confidences, errors, ev
    """

    games_sorted = sorted(games, key=lambda g: g.commence_time)

    recent_spreads = defaultdict(list)
    recent_win_probs = defaultdict(list)
    recent_accuracy = defaultdict(list)

    for game in games_sorted:
        best_h2h_outcome = None
        best_spread_outcome = None

        for bookmaker in game.bookmakers:
            h2h = next((m for m in bookmaker.markets if m.key == "h2h"), None)
            spreads = next((m for m in bookmaker.markets if m.key == "spreads"), None)
            if not h2h or not spreads:
                continue

            predicted_name = (
                game.homeTeamDetails.espnDisplayName
                if game.predictedWinner == "home"
                else game.awayTeamDetails.espnDisplayName
            )

            for o in h2h.outcomes:
                if o.name == predicted_name:
                    if best_h2h_outcome is None or o.price > best_h2h_outcome.price:
                        best_h2h_outcome = o

            for o in spreads.outcomes:
                if o.name == predicted_name:
                    if best_spread_outcome is None or o.price > best_spread_outcome.price:
                        best_spread_outcome = o

        if not best_h2h_outcome or not best_spread_outcome:
            continue
        if not game.complete:
            continue

        home = game.homeTeamDetails.espnDisplayName
        away = game.awayTeamDetails.espnDisplayName

        # ----------------------------------------
        # Spreads (projected, not actual)
        # ----------------------------------------
        projected_spread = game.predictedHomeScore - game.predictedAwayScore

        recent_spreads[home].append(projected_spread)
        recent_spreads[away].append(-projected_spread)

        # ----------------------------------------
        # Confidences
        # ----------------------------------------
        if game.predictedWinner == "home":
            p_home = game.predictionConfidence
            recent_win_probs[home].append(p_home)
        else:
            p_away = game.predictionConfidence
            recent_win_probs[away].append(p_away)

        if game.predictedWinner == "home":
            recent_accuracy[home].append(int(game.predictionCorrect))
            recent_accuracy[away].append(1 - int(game.predictionCorrect))
        else:
            recent_accuracy[away].append(int(game.predictionCorrect))
            recent_accuracy[home].append(1 - int(game.predictionCorrect))


        pass

    return {
        "spreads": recent_spreads,
        "confidences": recent_win_probs,
        "errors": recent_accuracy,
    }


def plot_value_score_decile_returns(games, sport=None, num_bins=5, n_bootstrap=10000, ci=0.98, plot=True):
    """
    Compute average unit return vs value_score decile, add bootstrap CIs, and optionally plot.
    """
    rows = []

    for game in games:
        # --- find best outcome (same logic you already use) ---
        best_outcome = None
        for bookmaker in game.bookmakers:
            if bookmaker.key != 'fanduel':
                continue
            market = next((m for m in bookmaker.markets if m.key == 'h2h'), None)
            if not market:
                continue
            for outcome in market.outcomes:
                predicted_name = (
                    game.homeTeamDetails.espnDisplayName
                    if game.predictedWinner == "home"
                    else game.awayTeamDetails.espnDisplayName
                )
                if outcome.name != predicted_name:
                    continue
                if best_outcome is None or outcome.price > best_outcome.price:
                    best_outcome = outcome

        if best_outcome is None:
            continue

        # --- eligibility: positive EV only ---
        decimal_odds = us_to_decimal(best_outcome.price)
        b = decimal_odds - 1
        p = game.predictionConfidence
        q = 1 - p

        raw_kelly = ((b * p) - q) / b
        if raw_kelly <= 0:
            continue

        # --- realized unit return ---
        if game.predictionCorrect:
            unit_return = us_odds_payout(best_outcome.price, 1.0) - 1.0
        else:
            unit_return = -1.0

        rows.append({
            "value_score": game.value_score,
            "unit_return": unit_return
        })

    if not rows:
        raise ValueError("No eligible games with positive EV found.")

    df = pd.DataFrame(rows)

    # --- compute deciles ---
    df["decile"], bin_edges = pd.qcut(
        df["value_score"],
        q=num_bins,
        labels=False,
        retbins=True,
        duplicates="drop"
    )

    summary = (
        df.groupby("decile")
        .agg(
            avg_return=("unit_return", "mean"),
            count=("unit_return", "size"),
            winrate=("unit_return", lambda x: np.mean(x > 0))
        )
        .reset_index()
    )

    summary["decile_mid"] = df.groupby("decile")["value_score"].mean().values

    # --- bootstrap confidence intervals ---
    lower_ci = []
    upper_ci = []
    for decile in summary["decile"]:
        data = df[df["decile"] == decile]["unit_return"].values
        if len(data) == 0:
            lower_ci.append(np.nan)
            upper_ci.append(np.nan)
            continue
        boot_means = [np.mean(np.random.choice(data, size=len(data), replace=True))
                      for _ in range(n_bootstrap)]
        lower_ci.append(np.percentile(boot_means, (1 - ci)/2 * 100))
        upper_ci.append(np.percentile(boot_means, (1 + ci)/2 * 100))

    summary["lower_ci"] = lower_ci
    summary["upper_ci"] = upper_ci

    return summary, bin_edges




def backtest_value_score_roi(games, sport, thresholds=np.arange(0, 1.01, 0.01)):
    """
    Backtest ROI with daily grouping, bankroll evolution, and front-end weighted Kelly allocation.
    """
    games_sorted = sorted(games, key=lambda g: g.commence_time)
    
    # Group games by date
    games_by_date = defaultdict(list)
    for g in games_sorted:
        g_pt = g.commence_time.astimezone(PACIFIC)
        games_by_date[g_pt.date()].append(g)
    
    roi_results = []
    
    for thresh in thresholds:
        threshold_games = [g for g in games if  g.value_score >= thresh]
        daily_bankroll = 10  # starting bankroll
        equity_curve = []
        peak_bankroll = daily_bankroll
        drawdowns = []
        total_wagered = 0
        edges_all = []
        valid_games_total = []
        # if sport.name == 'americanfootball_ncaaf':
        #   logger.info(f"============================================================================{thresh}=======================================================================================")
        for day, day_games in sorted(games_by_date.items()):
            # if sport.name == 'americanfootball_ncaaf':
            #     logger.info(f"======================================================{day}=========================================")
            # Select bets meeting threshold
            bets_today = [g for g in day_games if g.value_score >= thresh]
            if not bets_today:
                continue
            
            raw_kellys = []
            best_outcomes = []
            games_for_day = []

            # Step 1: compute raw Kelly for each bet
            for game in bets_today:
                best_h2h_outcome = None
                for bookmaker in game.bookmakers:
                    if bookmaker.key != 'fanduel':
                        continue
                    h2h_market_data = next((m for m in bookmaker.markets if m.key == 'h2h'), None)
                    if not h2h_market_data:
                        continue
                    for outcome in h2h_market_data.outcomes:
                        predicted_name = (
                            game.homeTeamDetails.espnDisplayName if game.predictedWinner == "home"
                            else game.awayTeamDetails.espnDisplayName
                        )
                        if outcome.name != predicted_name:
                            continue
                        if best_h2h_outcome is None or outcome.price > best_h2h_outcome.price:
                            best_h2h_outcome = outcome
                
                if best_h2h_outcome is None:
                    continue
                
                decimal_odds = us_to_decimal(best_h2h_outcome.price)
                b = decimal_odds - 1
                p = game.predictionConfidence
                q = 1 - p
                sportVariance = sport.variance
                sportReliability = sport.reliabilityWeight
                reliabilityFactor = sportReliability / sportVariance
                
                raw_kelly = ((b * p) - q) / b
                # raw_kelly *= reliabilityFactor
                if raw_kelly > 0:
                    raw_kellys.append(raw_kelly)  # front-end ignores negative
                    best_outcomes.append(best_h2h_outcome)
                    games_for_day.append(game)

            if not games_for_day:
                continue

            # Step 2: allocate stakes proportionally
            total_weight = max(sum(raw_kellys), 1)
            MAX_DAILY_EXPOSURE = 0.8
            SINGLE_BET_MAX = 1.0
            ALLOWED_CAPITAL = daily_bankroll * MAX_DAILY_EXPOSURE

            stakes_allocated = []
            for i, game in enumerate(games_for_day):
                weight_pct = raw_kellys[i] / total_weight
                stake = weight_pct * ALLOWED_CAPITAL
                stake = min(stake, SINGLE_BET_MAX * daily_bankroll)
                stake = max(stake, 0.1)
                stake = np.floor(stake * 10) / 10  # round down to nearest $0.10
                stakes_allocated.append((game, stake, best_outcomes[i]))

            # Step 3: execute bets
            day_profit = 0
            for game, stake, best_h2h_outcome in stakes_allocated:
                valid_games_total.append(game)
                if stake <= 0 or us_odds_payout(best_h2h_outcome.price, stake) < .01:
                    continue
                total_wagered += stake
                if game.predictionCorrect:
                    profit = us_odds_payout(best_h2h_outcome.price, stake) - stake
                    day_profit += profit
                    # if sport.name == 'americanfootball_ncaaf':
                    #   logger.info(f"{game.homeTeamDetails.espnDisplayName} vs {game.awayTeamDetails.espnDisplayName} WAGER: {stake} | PROFIT: {profit}")
                else:
                    day_profit -= stake
                    # if sport.name == 'americanfootball_ncaaf':
                    #   logger.info(f"{game.homeTeamDetails.espnDisplayName} vs {game.awayTeamDetails.espnDisplayName} WAGER: {stake} | PROFIT: {-stake}")
                edges_all.append(game.predictionConfidence - best_h2h_outcome.impliedProbability)


            daily_bankroll += day_profit
            # Track equity & drawdown
            equity_curve.append(daily_bankroll)

            if daily_bankroll > peak_bankroll:
                peak_bankroll = daily_bankroll

            drawdown = (peak_bankroll - daily_bankroll) / peak_bankroll
            drawdowns.append(drawdown)


        # Step 4: summarize metrics
        # logger.info(f"TOTAL GAMES SENT IN TO FUNCTION {len(games)} | VALID GAMES {len(valid_games_total)}")
        # or (len(valid_games_total) < len(games) * .21 and sport.name == 'americanfootball_ncaaf')
        if not valid_games_total or len(valid_games_total) < 5 :
            continue

        wins = [g for g in valid_games_total if g.predictionCorrect]
        roi = (daily_bankroll - 10) / total_wagered
        roi_score = roi * (len(valid_games_total) ** 0.6)
        winrate = len(wins) / len(valid_games_total)
        coverage = len(valid_games_total) / len(games)
        mean_ev = (daily_bankroll - 10) / len(valid_games_total)
        sample_weight = log(1 + len(valid_games_total))
        coverage_penalty = exp(-2.5 * -abs(coverage - 0.5))
        desirability = mean_ev * sample_weight * coverage_penalty
        avg_drawdown = np.mean(drawdowns) if drawdowns else 0
        max_drawdown = np.max(drawdowns) if drawdowns else 0
        profit_per_bet = (daily_bankroll - 10) / len(valid_games_total)
        equity_returns = np.diff(equity_curve)
        equity_sharpe = np.mean(equity_returns) / (np.std(equity_returns) + 1e-6)
        drawdown_penalty = (
            1
            + 3.0 * avg_drawdown
            + 5.0 * (max_drawdown ** 2)
        )

        combined_score = profit_per_bet * sample_weight / drawdown_penalty
        return_std = np.std(equity_returns) + 1e-6
        sem = return_std / np.sqrt(len(valid_games_total))
        confidence = profit_per_bet / sem

        combined_score *= np.tanh(abs(confidence))


        roi_results.append({
            'threshold': thresh,
            'num_bets': len(valid_games_total),
            'roi': roi,
            'roi_score': roi_score,
            'total_profit': daily_bankroll,
            'winrate': winrate,
            'combined_score': combined_score,
            'coverage': coverage,
            'coverage_penalty': coverage_penalty,
            'peak_bankroll': peak_bankroll,
            'avg_drawdown': avg_drawdown,
            'max_drawdown': max_drawdown,
            'equity_sharpe': equity_sharpe,
            'profit_per_bet': profit_per_bet,
            'return_std': return_std,
            "sem": sem,
            "confidence": confidence,
        })


    # Step 5: find best threshold
    best = max(roi_results, key=lambda x: x['combined_score']) if roi_results else None
    logger.info("=====================================THRESH RANKED BY COMBINED SCORE====================================================")
    for result in sorted(roi_results, key = lambda r: r['combined_score'], reverse=True)[:10]:
        render_results_row(result)

    return best, roi_results

