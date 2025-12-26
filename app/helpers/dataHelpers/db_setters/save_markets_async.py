import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.market_model import Markets
from app.helpers.dataHelpers.db_setters.save_outcomes_async import save_outcomes_async

logger = logging.getLogger(__name__)

async def save_markets_async(bookmaker_id, markets, session, sport):
        try:
            for market in markets:
                stmt = select(Markets).where(Markets.bookmakerId == bookmaker_id, Markets.key == market['key'])
                result = await session.execute(stmt)
                existing_market = result.scalar_one_or_none()

                payload = {
                    "bookmakerId": bookmaker_id,
                    "key": market['key']
                }

                if existing_market:
                    #build bookmaker payload 

                    # --- Update existing record ---
                    for key, value in payload.items():
                        if hasattr(existing_market, key):
                            setattr(existing_market, key, value)
                    await save_outcomes_async(existing_market.id, market['outcomes'], session, sport)
                else:
                    # --- Insert new record ---
                    new_market = Markets(**payload) 
                    session.add(new_market)
                    await session.flush()
                    await save_outcomes_async(new_market.id, market['outcomes'], session, sport)
        except Exception as e:
            logger.exception(f"Error saving markets {markets}: {e}")
            await session.rollback()