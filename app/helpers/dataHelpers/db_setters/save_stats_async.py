import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.stat_model import Stats

logger = logging.getLogger(__name__)

async def save_stats_async(team, payload, AsyncSessionLocal):
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(Stats).where(Stats.gameId == payload['gameId'], Stats.teamId == payload['teamId'])
            result = await session.execute(stmt)
            existing_stats = result.scalar_one_or_none()

            if existing_stats:
                # --- Update existing record ---
                for key, value in payload.items():
                    if hasattr(existing_stats, key):
                        setattr(existing_stats, key, value)
                    await session.commit()
            else:
                # --- Insert new record ---
                new_stats = Stats(**payload) 
                session.add(new_stats)
                await session.commit()
        except Exception as e:
            logger.exception(f"Error saving stats {payload}: {e}")
            await session.rollback()