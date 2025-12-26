import logging
from sqlalchemy import select
from app.database.valueBetSettings_model import ValueBetSettings

logger = logging.getLogger(__name__)


async def save_value_bet_segment(async_session, payload):
    """
    Insert or update a value bet segment in the database.
    """
    async with async_session() as session:
        try:
            # Find existing segment (sport + segmentKey is unique)
            stmt = select(ValueBetSettings).where(
                (ValueBetSettings.sport == payload["sport"]) &
                (ValueBetSettings.segmentKey == payload["segmentKey"])
            )

            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                # Update
                for key, value in payload.items():
                    if hasattr(existing, key):
                        setattr(existing, key, value)
            else:
                # Insert
                new_rec = ValueBetSettings(**payload)
                session.add(new_rec)

            await session.commit()
            return True

        except Exception as e:
            logger.exception(
                f"Error saving value_bet_segment: sport={payload.get('sport')} "
                f"segmentKey={payload.get('segmentKey')} → {e}"
            )
            await session.rollback()
            return False
