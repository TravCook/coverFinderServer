import logging
from sqlalchemy import select
from app.database.hyperParameters_model import HyperParameters

logger = logging.getLogger(__name__)


async def save_hyperparams(async_session, sport, payload):
    """
    Insert or update a team in the database.
    :param team_data: dict with team info (matching Teams model)
    :param payload: JSON object (with fields to be updated / saved)
    """
    async with async_session() as session:
        try:
            # Try to find existing hyperparams
            stmt = select(HyperParameters).where(HyperParameters.sport == sport.id)
            result = await session.execute(stmt)
            existing_hyperparams = result.scalar_one_or_none()

            if existing_hyperparams:
                # --- Update existing record ---
                for key, value in payload.items():
                    if hasattr(existing_hyperparams, key):
                        setattr(existing_hyperparams, key, value)
            else:
                # --- Insert new record ---
                new_game = HyperParameters(payload)
                session.add(new_game)

            await session.commit()

        except Exception as e:
            logger.exception(f"Error saving hyperparams for {sport.name}: {e}")
            await session.rollback()