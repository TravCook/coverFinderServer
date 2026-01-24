import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database.sport_model import Sports

async def get_sports_sync(AsyncSessionLocal):
    async with AsyncSessionLocal() as session:
        stmt = (
            select(Sports)
            .options(
                selectinload(Sports.hyperParameters),
                selectinload(Sports.mlModelWeights),
                selectinload(Sports.valueBetSettings)
            )
            .order_by(Sports.name)
        )
        result = await session.execute(stmt)
        return result.scalars().all()