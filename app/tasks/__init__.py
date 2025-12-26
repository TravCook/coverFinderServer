# app/tasks/__init__.py
from .odds_fetch_task import odds_fetch
from .stat_fetch_task import fetch_team_stats
from .remove_games_task import remove_games
from .model_train_task import train_k_fold
