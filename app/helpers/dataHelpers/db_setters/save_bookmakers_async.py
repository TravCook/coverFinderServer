import logging
from sqlalchemy import select
from app.database.bookmaker_model import Bookmakers
from app.helpers.dataHelpers.db_setters.save_markets_async import save_markets_async

logger = logging.getLogger(__name__)

async def save_bookmakers_async(game_id, bookmakers, session, sport):
        try:
            for bookmaker in bookmakers:
                stmt = select(Bookmakers).where(Bookmakers.gameId == game_id, Bookmakers.key == bookmaker['key'])
                result = await session.execute(stmt)
                existing_bookmaker = result.scalar_one_or_none()

                payload = {
                    "gameId": game_id,
                    "title": bookmaker['title'],
                    "key": bookmaker['key']
                }

                if existing_bookmaker:
                    #build bookmaker payload 

                    # --- Update existing record ---
                    for key, value in payload.items():
                        if hasattr(existing_bookmaker, key):
                            setattr(existing_bookmaker, key, value)
                    await save_markets_async(existing_bookmaker.id, bookmaker['markets'], session, sport)
                else:
                    # --- Insert new record ---
                    new_bookmaker = Bookmakers(**payload) 
                    session.add(new_bookmaker)
                    await session.flush()
                    await save_markets_async(new_bookmaker.id, bookmaker['markets'], session, sport)

        except Exception as e:
            logger.exception(f"Error saving bookmakers {bookmakers}: {e}")
            await session.rollback()