from celery import Celery
from celery.schedules import crontab
import logging

# Set up your own formatter with timestamps
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S %Z",
)


celery = Celery(
    "app",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0",
)

celery.conf.update(
    timezone="America/Denver",
)

celery.autodiscover_tasks(["app.tasks"])



celery.conf.update(
    beat_schedule={
        "odds-api-fetch": {
            "task": "app.tasks.odds_fetch_task.odds_fetch",
            "schedule": crontab(minute=0, hour='8,12,16,20')
        },
        "team-stat-fetch": {
            "task": "app.tasks.stat_fetch_task.fetch_team_stats",
            "schedule": crontab(hour="4-23", minute=30)
        },
        "remove-game": {
            "task": "app.tasks.remove_games_task.remove_games",
            "schedule": crontab(hour="4-23", minute="*")
        },
        "model-train": {
            "task": "app.tasks.model_train_task.train_k_fold",
            "schedule": crontab(hour=0, minute=0)
        }
    }
)
