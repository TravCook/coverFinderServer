import logging
from sqlalchemy import select
from app.database.sport_model import Sports

logger = logging.getLogger(__name__)


async def save_sport(async_session, payload):
    """
    Insert or update a value bet segment in the database.
    """
    async with async_session() as session:
        try:
            # Find existing segment (sport + segmentKey is unique)
            stmt = select(Sports).where(
                (Sports.id == payload["sport"])
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
                new_rec = Sports(**payload)
                session.add(new_rec)

            await session.commit()
            return True

        except Exception as e:
            logger.exception(
                f"Error saving {payload.get('name')}"
            )
            await session.rollback()
            return False
