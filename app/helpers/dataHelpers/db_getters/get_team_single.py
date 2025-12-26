import logging
logger = logging.getLogger(__name__)
from sqlalchemy import select
from app.database.team_model import Teams
from app.helpers.dataHelpers.normalize_team_name import normalize_team_name

async def get_team_single(team_name, league, AsyncSessionLocal):
    """Run async query from sync context."""
    async with AsyncSessionLocal() as session:
        stmt = select(Teams).where((Teams.espnDisplayName == normalize_team_name(team_name, league)) & (Teams.league == league))
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


    