import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.game_model import Games
from app.helpers.dataHelpers.db_setters.save_bookmakers_async import save_bookmakers_async

logger = logging.getLogger(__name__)

async def save_game_async(game_data: dict, payload, AsyncSessionLocal, sport, new_odds = False):
    """
    Insert or update a game in the database.
    :param game_data: dict with game info (matching Games model)
    :param payload: JSON object (with fields to be updated / saved)
    """
    async with AsyncSessionLocal() as session:
        try:
            if new_odds:
                game_id = game_data['id']
            else:
                game_id = game_data.oddsApiID
                # game_id = payload['oddsApiID'] #this is for when saving past games as part of past_game_data_builder

            # Try to find existing game
            stmt = select(Games).where(Games.oddsApiID == game_id)
            result = await session.execute(stmt)
            existing_game = result.scalar_one_or_none()
            if existing_game:
                # --- Update existing record ---
                for key, value in payload.items():
                    if hasattr(existing_game, key):
                        setattr(existing_game, key, value)
                # if game_data.bookmakers.length > 0:
                if new_odds == True:
                    await save_bookmakers_async(existing_game.id, game_data['bookmakers'], session, sport)
                    await session.commit()
                    return existing_game.id
            else:
                # --- Insert new record ---
                new_game = Games(**payload) 
                session.add(new_game)
                await session.flush()
                if new_odds == True:
                    await save_bookmakers_async(new_game.id, game_data['bookmakers'], session, sport)
                    await session.commit()
                    return new_game.id

            await session.commit()
            return existing_game.id if existing_game else new_game.id
             
        except Exception as e:
            logger.exception(f"Error saving game {game_data}: {e}")
            await session.rollback()
