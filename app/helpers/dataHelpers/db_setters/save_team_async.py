import logging
from sqlalchemy import select
from app.database.team_model import Teams

logger = logging.getLogger(__name__)

async def save_team_async(team_data: dict, payload, AsyncSessionLocal):
    """
    Insert or update a team in the database.
    :param team_data: dict with team info (matching Teams model)
    :param payload: JSON object (with fields to be updated / saved)
    """
    async with AsyncSessionLocal() as session:
        try:
            team_id = team_data.id

            # Try to find existing team
            stmt = select(Teams).where(Teams.id == team_id)
            result = await session.execute(stmt)
            existing_team = result.scalar_one_or_none()

            if existing_team:
                # --- Update existing record ---
                for key, value in payload.items():
                    if hasattr(existing_team, key):
                        setattr(existing_team, key, value)
            else:
                # --- Insert new record ---
                new_game = Teams(payload)
                session.add(new_game)

            await session.commit()

        except Exception as e:
            logger.exception(f"Error saving game {team_data}: {e}")
            await session.rollback()
