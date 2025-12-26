import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database.sport_model import Sports

async def get_sports_sync(AsyncSessionLocal):
    """Run async query from sync context."""
    async with AsyncSessionLocal() as session:
        stmt = select(Sports).options(
            selectinload(Sports.hyperParameters),
            selectinload(Sports.mlModelWeights),
            selectinload(Sports.valueBetSettings)
        )
        result = await session.execute(stmt)
        return result.scalars().all()

