import logging
logger = logging.getLogger(__name__)
from sqlalchemy import select
from app.database.team_model import Teams

async def get_teams_by_sport(sport, AsyncSessionLocal):
    """Run async query from sync context."""
    async with AsyncSessionLocal() as session:
        stmt = select(Teams).where(Teams.league == sport.name)
        result = await session.execute(stmt)
        return result.scalars().all()


    