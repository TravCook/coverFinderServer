import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.mlModelWeights import MlModelWeights
from app.main import AsyncSessionLocal

logger = logging.getLogger(__name__)

async def save_ml_weights(sport, payload, AsyncSessionLocal):
    """
    Insert or update a game in the database.
    :param sport with sport info (matching Sports model)
    :param payload: JSON object (with fields to be updated / saved)
    """
    async with AsyncSessionLocal() as session:
        try:
            sport_id = sport.id 

            # Try to find existing game
            stmt = select(MlModelWeights).where(MlModelWeights.sport == sport_id)
            result = await session.execute(stmt)
            existing_weights = result.scalar_one_or_none()

            if existing_weights:
                # --- Update existing record ---
                for key, value in payload.items():
                    if hasattr(existing_weights, key):
                        setattr(existing_weights, key, value)
            else:
                # --- Insert new record ---
                new_game = MlModelWeights(payload)
                session.add(new_game)

            await session.commit()

        except Exception as e:
            logger.exception(f"Error saving weights for {sport.name}: {e}")
            await session.rollback()
