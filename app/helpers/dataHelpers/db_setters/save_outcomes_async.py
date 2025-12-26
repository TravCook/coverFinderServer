import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.outcome_model import Outcomes
from app.database.team_model import Teams
from app.helpers.dataHelpers.normalize_team_name import normalize_team_name

logger = logging.getLogger(__name__)

def calculate_implied_prob(us_odds):
    if us_odds > 0:
        # Positive odds (e.g., +150)
        probability = 100 / (us_odds + 100)
    else:
        # Negative odds (e.g., -150)
        probability = -us_odds / (-us_odds + 100)
    
    return probability



async def save_outcomes_async(market_id, outcomes, session, sport):
        try:
            for outcome in outcomes:
                if outcome['name'] != 'Over' and outcome['name'] != 'Under':
                    team_name = normalize_team_name(outcome['name'], sport)
                    stmt = select(Outcomes).where(Outcomes.marketId == market_id, Outcomes.name == team_name)
                    result = await session.execute(stmt)
                    existing_outcome = result.scalar_one_or_none()

                    

                    team_stmt = select(Teams).where(
                        Teams.espnDisplayName == team_name,
                        Teams.league == sport
                    )
                    result = await session.execute(team_stmt)
                    existing_team = result.scalar_one_or_none()

                    if not existing_team:
                        logger.warning(f"No match for team '{team_name}' in Teams table.")

                else:
                    stmt = select(Outcomes).where(Outcomes.marketId == market_id, Outcomes.name == outcome['name'])
                    result = await session.execute(stmt)
                    existing_outcome = result.scalar_one_or_none()
                    existing_team = None 

                payload = {
                    "marketId": market_id,
                    "name": team_name if existing_team else outcome["name"],
                    "price": outcome["price"],
                    "impliedProbability": calculate_implied_prob(outcome["price"])
                }

                if outcome.get("point") is not None:
                    payload["point"] = outcome["point"]

                if existing_team and getattr(existing_team, "id", None):
                    payload["teamId"] = existing_team.id


                if existing_outcome:
                    # --- Update existing record ---
                    for key, value in payload.items():
                        if hasattr(existing_outcome, key):
                            setattr(existing_outcome, key, value)
                else:
                    # --- Insert new record ---
                    new_outcome = Outcomes(**payload) 
                    session.add(new_outcome)
                    await session.flush()
        except Exception as e:
            logger.exception(f"Error saving outcome {outcome}: {e}")
            await session.rollback()