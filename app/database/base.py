from sqlalchemy.orm import DeclarativeBase 


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass

import typing, sys

if typing.TYPE_CHECKING or "alembic" in sys.modules:
    from app.database.bookmaker_model import Bookmakers
    from app.database.game_model import Games
    from app.database.hyperParameters_model import HyperParameters
    from app.database.market_model import Markets
    from app.database.mlModelWeights import MlModelWeights
    from app.database.outcome_model import Outcomes
    from app.database.sport_model import Sports
    from app.database.stat_model import Stats
    from app.database.team_model import Teams
    from app.database.valueBetSettings_model import ValueBetSettings