import asyncio
from app.tasks.stat_fetch_task import fetch_team_stats_async
from app.tasks.model_train_task import train_k_fold_async
from app.tasks.odds_fetch_task import odds_fetch_async
from app.tasks.remove_games_task import remove_games_async
from app.helpers.trainingHelpers.hyperparam_tuning import tune_hyperparams_async
from app.helpers.dataHelpers.past_game_data_builder import past_game_data_builder
from app.tasks.value_bet_backtest_task import value_bet_backtest_async, value_bet_model_analysis


if __name__ == "__main__":
    asyncio.run(odds_fetch_async())